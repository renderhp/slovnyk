"""Packs dictionary databases for the web app.

Each <lang>.sqlite is gzipped and split into parts (GitHub Pages rejects files
over 100 MB), and a data/manifest.json describing them is written.

    python3 web/scripts/prepare-data.py --manifest dist/manifest.json --sqlite-dir dist --out web/public/data

--manifest is the release manifest.json (or a single <lang>.info.json).
"""
import argparse
import gzip
import json
import shutil
from pathlib import Path

PART_SIZE = 20 * 1024 * 1024


def pack(sqlite: Path, out_dir: Path, lang: str) -> list[dict]:
    packed = out_dir / f"{lang}.sqlite.gz"
    with open(sqlite, "rb") as src, open(packed, "wb") as raw:
        # mtime=0 keeps the output identical for identical input.
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as gz:
            shutil.copyfileobj(src, gz, length=1 << 20)

    parts = []
    with open(packed, "rb") as f:
        index = 0
        while chunk := f.read(PART_SIZE):
            name = f"{lang}.sqlite.gz.{index:03d}"
            (out_dir / name).write_bytes(chunk)
            parts.append({"file": name, "size": len(chunk)})
            index += 1
    packed.unlink()
    return parts


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--manifest", required=True)
    p.add_argument("--sqlite-dir", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    source = json.loads(Path(args.manifest).read_text())
    infos = source["dictionaries"] if "dictionaries" in source else [source]
    out_dir = Path(args.out)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    dictionaries = []
    for info in infos:
        lang = info["lang"]
        sqlite = Path(args.sqlite_dir) / f"{lang}.sqlite"
        size = sqlite.stat().st_size
        if size != info["uncompressed_size"]:
            raise SystemExit(f"{sqlite} is {size} bytes, manifest says {info['uncompressed_size']}")
        parts = pack(sqlite, out_dir, lang)
        dictionaries.append({
            "lang": lang,
            "name": info["name"],
            "schema_version": info["schema_version"],
            "entry_count": info["entry_count"],
            "build_date": info["build_date"],
            "size": sum(part["size"] for part in parts),
            "uncompressed_size": size,
            "parts": parts,
        })
        print(f"{lang}: {len(parts)} parts, {dictionaries[-1]['size'] / 1e6:.0f} MB")

    (out_dir / "manifest.json").write_text(
        json.dumps({"manifest_version": 1, "dictionaries": dictionaries}, indent=2, ensure_ascii=False)
    )


if __name__ == "__main__":
    main()
