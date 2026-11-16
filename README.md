# Slovnyk

An offline dictionary app for iOS, built on Wiktionary.

- **Data:** [Wiktionary](https://www.wiktionary.org), via the [Wiktextract](https://github.com/tatuylonen/wiktextract) extracts published on [kaikki.org](https://kaikki.org).
- **Dictionaries:** built monthly into SQLite files by `pipeline/` and published as [GitHub releases](../../releases). The app downloads the language you pick.
- **Languages:** English (English words, English definitions). More later.

## Building a dictionary locally

```sh
python3 pipeline/build.py download en
python3 pipeline/build.py build en --input data/raw/en.jsonl.gz
```

## Building the app

```sh
brew install xcodegen
cd ios && xcodegen generate && open Slovnyk.xcodeproj
```

## License

Code: MIT. Dictionary data: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), see [DATA_LICENSE.md](DATA_LICENSE.md).
