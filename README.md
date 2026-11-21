# Slovnyk

An offline dictionary built on Wiktionary: a web app you install to your home screen
(**https://renderhp.github.io/slovnyk/**), plus a native iOS app.

- **Data:** [Wiktionary](https://www.wiktionary.org), via the [Wiktextract](https://github.com/tatuylonen/wiktextract) extracts published on [kaikki.org](https://kaikki.org).
- **Dictionaries:** built monthly into SQLite files by `pipeline/` and published as [GitHub releases](../../releases). The app downloads the language you pick.
- **Languages:** English, Ukrainian, German, Spanish and French, all with English definitions (from English Wiktionary).

## Building a dictionary locally

```sh
python3 pipeline/build.py download en
python3 pipeline/build.py build en --input data/raw/en.jsonl.gz
```

## Running the web app

```sh
python3 web/scripts/prepare-data.py --manifest dist/en.info.json --sqlite-dir dist --out web/public/data
cd web && npm install && npm run dev   # open http://localhost:5173/?inBrowser=1 to skip the install page
```

## Building the iOS app

```sh
brew install xcodegen
cd ios && xcodegen generate && open Slovnyk.xcodeproj
```

## License

Code: MIT. Dictionary data: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), see [DATA_LICENSE.md](DATA_LICENSE.md).
