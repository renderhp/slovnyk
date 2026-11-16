import json
import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build  # noqa: E402

FIXTURE = Path(__file__).with_name("fixture.jsonl")


class NormalizeTest(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(build.normalize("Café"), "cafe")
        self.assertEqual(build.normalize("  don’t   stop "), "don't stop")
        self.assertEqual(build.normalize("NAÏVE"), "naive")


class SelectExamplesTest(unittest.TestCase):
    def test_usage_examples_first_then_shortest_quotations(self):
        raw = [
            {"text": "quote that is quite long", "type": "quotation", "ref": "A"},
            {"text": "usage one", "type": "example"},
            {"text": "short quote", "type": "quotation", "ref": "B"},
            {"text": "mid-size quote", "type": "quotation", "ref": "C"},
        ]
        texts = [e["text"] for e in build.select_examples(raw)]
        self.assertEqual(texts, ["usage one", "short quote", "mid-size quote"])

    def test_cap_with_only_usage_examples(self):
        raw = [{"text": f"ex {i}", "type": "example"} for i in range(6)]
        raw.append({"text": "q", "type": "quotation", "ref": "R"})
        self.assertEqual(len(build.select_examples(raw)), build.MAX_EXAMPLES_PER_SENSE)
        self.assertNotIn("ref", build.select_examples(raw)[-1])


class CleanRefTest(unittest.TestCase):
    def test_clean_ref(self):
        self.assertEqual(
            build.clean_ref("2001, John Smith, Some Book […], Penguin, →ISBN, page 12, archived from the original on 1 May 2020:"),
            "2001, John Smith, Some Book, Penguin, page 12",
        )


class BuildTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.db = self.tmp / "en.sqlite"
        self.meta = build.build_db("en", FIXTURE, self.db, {})
        self.con = sqlite3.connect(self.db)

    def tearDown(self):
        self.con.close()

    def test_counts(self):
        # "empty" has no glosses, "Hund" is German
        self.assertEqual(self.meta["entry_count"], "3")

    def test_entry_content(self):
        (data,) = self.con.execute("SELECT data FROM entries WHERE word = 'free'").fetchone()
        data = json.loads(data)
        self.assertEqual(len(data["senses"]), 1)
        sense = data["senses"][0]
        self.assertEqual(sense["qualifier"], "social")
        self.assertEqual(sense["examples"], [{"text": "a free man"}, {"text": "Long quote", "ref": "1900, Someone"}])
        self.assertEqual([i["ipa"] for i in data["ipa"]], ["/fɹiː/"])
        self.assertEqual(data["audio"], [{"url": "https://example.org/a.mp3", "file": "En-uk-free.ogg", "tags": ["UK"]}])
        self.assertNotIn("etymology", data)

    def test_form_of(self):
        (data,) = self.con.execute("SELECT data FROM entries WHERE word = 'went'").fetchone()
        self.assertEqual(json.loads(data)["senses"][0]["form_of"], ["go"])

    def test_lookup(self):
        rows = dict(self.con.execute(
            "SELECT l.norm, l.kind FROM lookup l JOIN entries e ON e.id = l.entry_id"
        ).fetchall())
        self.assertEqual(rows["free"], 0)
        self.assertEqual(rows["freer"], 1)
        self.assertEqual(rows["cafe"], 0)
        self.assertNotIn("no-table-tags", rows)


if __name__ == "__main__":
    unittest.main()
