"""Build Slovnyk dictionary databases from Wiktextract (kaikki.org) JSONL dumps.

Usage:
    python pipeline/build.py download en --out data/raw
    python pipeline/build.py build en --input data/raw/en.jsonl.gz --out dist
    python pipeline/build.py manifest --dist dist --base-url URL --out dist/manifest.json

Only the Python standard library is used.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import lzma
import os
import shutil
import sqlite3
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

SCHEMA_VERSION = 1
LANGUAGES_FILE = Path(__file__).with_name("languages.json")

MAX_EXAMPLES_PER_SENSE = 5
MAX_EXAMPLE_LEN = 300

# Tags on `forms` that describe table structure rather than an actual word form.
IGNORED_FORM_TAGS = {"table-tags", "inflection-template", "class", "romanization"}

SCHEMA = """
CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) WITHOUT ROWID;

-- One row per Wiktionary entry (word + part of speech + etymology).
-- `data` is JSON: {"senses": [...], "ipa": [...], "audio": [...]}
CREATE TABLE entries (
    id    INTEGER PRIMARY KEY,
    word  TEXT NOT NULL,
    pos   TEXT NOT NULL,
    data  TEXT NOT NULL
);

-- Everything searchable, normalized with `normalize()`.
-- kind: 0 = headword of the entry, 1 = inflected/alternative form pointing at the entry.
CREATE TABLE lookup (
    norm     TEXT NOT NULL,
    entry_id INTEGER NOT NULL,
    kind     INTEGER NOT NULL,
    PRIMARY KEY (norm, entry_id)
) WITHOUT ROWID;
"""


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


def load_languages() -> dict:
    return json.loads(LANGUAGES_FILE.read_text())


def normalize(s: str) -> str:
    """Search key: compatibility-decompose, drop combining marks, lowercase,
    unify apostrophes, collapse whitespace. The app must apply the same steps."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("’", "'").replace("‘", "'")
    return " ".join(s.split())


# --------------------------------------------------------------------------- #
# Entry conversion
# --------------------------------------------------------------------------- #

def _clean_list(values) -> list[str]:
    return [v for v in (values or []) if isinstance(v, str) and v]


def convert_sense(sense: dict) -> dict | None:
    glosses = _clean_list(sense.get("glosses"))
    if not glosses:
        return None
    out: dict = {"glosses": glosses}

    tags = [t for t in _clean_list(sense.get("tags")) if t not in ("no-gloss",)]
    if tags:
        out["tags"] = tags
    topics = _clean_list(sense.get("topics"))
    if topics:
        out["topics"] = topics
    if isinstance(sense.get("qualifier"), str) and sense["qualifier"]:
        out["qualifier"] = sense["qualifier"]

    for key in ("form_of", "alt_of"):
        targets = [t["word"] for t in sense.get(key) or [] if isinstance(t, dict) and t.get("word")]
        if targets:
            out[key] = targets

    examples = select_examples(sense.get("examples") or [])
    if examples:
        out["examples"] = examples
    return out


def select_examples(raw_examples: list) -> list[dict]:
    """Up to MAX_EXAMPLES_PER_SENSE short usage examples: {"text", "translation"?}.
    Literary quotations (with a source reference) are skipped."""
    chosen = []
    for ex in raw_examples:
        if ex.get("type") == "quotation" or ex.get("ref"):
            continue
        text = " ".join((ex.get("text") or "").split())
        if not text or len(text) > MAX_EXAMPLE_LEN:
            continue
        item = {"text": text}
        translation = (ex.get("english") or ex.get("translation") or "").strip()
        if translation:
            item["translation"] = translation
        chosen.append(item)
        if len(chosen) >= MAX_EXAMPLES_PER_SENSE:
            break
    return chosen


def convert_sounds(sounds: list) -> tuple[list, list]:
    ipa, audio, seen_ipa, seen_audio = [], [], set(), set()
    for s in sounds or []:
        tags = _clean_list(s.get("tags"))
        if s.get("ipa") and s["ipa"] not in seen_ipa:
            seen_ipa.add(s["ipa"])
            item = {"ipa": s["ipa"]}
            if tags:
                item["tags"] = tags
            ipa.append(item)
        # mp3 because iOS can't play Ogg Vorbis natively.
        url = s.get("mp3_url")
        if url and url not in seen_audio:
            seen_audio.add(url)
            item = {"url": url}
            if s.get("audio"):
                item["file"] = s["audio"]  # Commons file name, for attribution
            if tags:
                item["tags"] = tags
            audio.append(item)
    return ipa, audio


def convert_entry(raw: dict) -> tuple[dict, list[str]] | None:
    """Returns (entry, forms) or None if the entry has nothing worth showing."""
    word, pos = raw.get("word"), raw.get("pos")
    if not word or not pos:
        return None
    senses = [s for s in (convert_sense(x) for x in raw.get("senses") or []) if s]
    if not senses:
        return None
    ipa, audio = convert_sounds(raw.get("sounds"))

    data: dict = {"senses": senses}
    if ipa:
        data["ipa"] = ipa
    if audio:
        data["audio"] = audio

    forms = []
    for f in raw.get("forms") or []:
        form = f.get("form")
        if not form or form == word or form == "-":
            continue
        if IGNORED_FORM_TAGS.intersection(f.get("tags") or []):
            continue
        forms.append(form)

    return {"word": word, "pos": pos, "data": data}, forms


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #

def cmd_download(args) -> None:
    lang = load_languages()[args.lang]
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / f"{args.lang}.jsonl.gz"
    tmp = dest.with_suffix(".part")
    log(f"Downloading {lang['source_url']}")
    req = urllib.request.Request(lang["source_url"], headers={"User-Agent": "slovnyk-pipeline"})
    with urllib.request.urlopen(req) as resp, open(tmp, "wb") as f:
        last_modified = resp.headers.get("Last-Modified", "")
        shutil.copyfileobj(resp, f, length=1 << 20)
    tmp.rename(dest)
    (out_dir / f"{args.lang}.source.json").write_text(
        json.dumps({"url": lang["source_url"], "last_modified": last_modified})
    )
    log(f"Saved {dest} ({dest.stat().st_size / 1e6:.0f} MB)")


def open_jsonl(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8")
    return open(path, encoding="utf-8")


def build_db(lang_key: str, input_path: Path, db_path: Path, source_info: dict) -> dict:
    lang = load_languages()[lang_key]
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    con.executescript(
        "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA page_size=4096;" + SCHEMA
    )

    entry_rows, lookup_rows = [], []
    entry_id = 0
    lines = skipped = 0

    def flush():
        con.executemany("INSERT INTO entries (id, word, pos, data) VALUES (?, ?, ?, ?)", entry_rows)
        con.executemany("INSERT OR IGNORE INTO lookup (norm, entry_id, kind) VALUES (?, ?, ?)", lookup_rows)
        entry_rows.clear()
        lookup_rows.clear()

    with open_jsonl(input_path) as f:
        for line in f:
            lines += 1
            raw = json.loads(line)
            if raw.get("lang_code") != lang["lang_code"]:
                skipped += 1
                continue
            converted = convert_entry(raw)
            if converted is None:
                skipped += 1
                continue
            entry, forms = converted
            entry_id += 1
            entry_rows.append((
                entry_id, entry["word"], entry["pos"],
                json.dumps(entry["data"], ensure_ascii=False, separators=(",", ":")),
            ))
            head = normalize(entry["word"])
            lookup_rows.append((head, entry_id, 0))
            for form in forms:
                n = normalize(form)
                if n and n != head:
                    lookup_rows.append((n, entry_id, 1))
            if len(entry_rows) >= 20000:
                flush()
            if lines % 200000 == 0:
                log(f"  {lines:,} lines read, {entry_id:,} entries")
    flush()

    # If a form row and a headword row collide, the headword wins (kind 0).
    lookup_count = con.execute("SELECT count(*) FROM lookup").fetchone()[0]
    meta = {
        "schema_version": str(SCHEMA_VERSION),
        "lang": lang_key,
        "lang_name": lang["name"],
        "entry_count": str(entry_id),
        "lookup_count": str(lookup_count),
        "build_date": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_url": source_info.get("url", lang["source_url"]),
        "source_last_modified": source_info.get("last_modified", ""),
        "license": "CC BY-SA 4.0",
        "attribution": "Content from Wiktionary (https://www.wiktionary.org), by Wiktionary "
                       "contributors, extracted with Wiktextract (https://kaikki.org). Modified.",
    }
    con.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", meta.items())
    con.commit()
    con.execute("ANALYZE")
    con.execute("VACUUM")
    con.close()
    log(f"Done: {lines:,} lines, {entry_id:,} entries, {lookup_count:,} lookup rows, {skipped:,} skipped")
    return meta


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def compress(src: Path, dest: Path) -> None:
    # xz container, decodable by Apple's Compression framework (COMPRESSION_LZMA).
    with open(src, "rb") as fi, lzma.open(dest, "wb", preset=6, check=lzma.CHECK_CRC64) as fo:
        shutil.copyfileobj(fi, fo, length=1 << 20)


def cmd_build(args) -> None:
    input_path = Path(args.input)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    source_file = input_path.parent / f"{args.lang}.source.json"
    source_info = json.loads(source_file.read_text()) if source_file.exists() else {}

    db_path = out_dir / f"{args.lang}.sqlite"
    log(f"Building {db_path} from {input_path}")
    meta = build_db(args.lang, input_path, db_path, source_info)

    xz_path = out_dir / f"{args.lang}.sqlite.xz"
    log(f"Compressing to {xz_path}")
    compress(db_path, xz_path)

    info = {
        "lang": args.lang,
        "name": meta["lang_name"],
        "file": xz_path.name,
        "schema_version": SCHEMA_VERSION,
        "size": xz_path.stat().st_size,
        "sha256": sha256(xz_path),
        "uncompressed_size": db_path.stat().st_size,
        "uncompressed_sha256": sha256(db_path),
        "entry_count": int(meta["entry_count"]),
        "build_date": meta["build_date"],
        "source_last_modified": meta["source_last_modified"],
    }
    (out_dir / f"{args.lang}.info.json").write_text(json.dumps(info, indent=2))
    log(f"DB {info['uncompressed_size'] / 1e6:.0f} MB, compressed {info['size'] / 1e6:.0f} MB")
    if not args.keep_db:
        db_path.unlink()


def cmd_manifest(args) -> None:
    dist = Path(args.dist)
    base = args.base_url.rstrip("/")
    dictionaries = []
    for p in sorted(dist.glob("*.info.json")):
        info = json.loads(p.read_text())
        info["url"] = f"{base}/{info['file']}"
        dictionaries.append(info)
    manifest = {
        "manifest_version": 1,
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dictionaries": dictionaries,
    }
    Path(args.out).write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    log(f"Wrote {args.out} with {len(dictionaries)} dictionaries")


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("download", help="download a kaikki.org dump")
    d.add_argument("lang")
    d.add_argument("--out", default="data/raw")
    d.set_defaults(func=cmd_download)

    b = sub.add_parser("build", help="build and compress a SQLite dictionary")
    b.add_argument("lang")
    b.add_argument("--input", required=True)
    b.add_argument("--out", default="dist")
    b.add_argument("--keep-db", action="store_true", help="keep the uncompressed .sqlite")
    b.set_defaults(func=cmd_build)

    m = sub.add_parser("manifest", help="write manifest.json for built dictionaries")
    m.add_argument("--dist", default="dist")
    m.add_argument("--base-url", required=True)
    m.add_argument("--out", default="dist/manifest.json")
    m.set_defaults(func=cmd_manifest)

    args = p.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
