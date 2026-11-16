import Foundation

/// One Wiktionary entry: a word in one part of speech (and etymology).
struct Entry: Identifiable, Hashable, Sendable {
    let id: Int64
    let word: String
    let pos: String
    let data: EntryData
}

struct EntryData: Decodable, Hashable, Sendable {
    let senses: [Sense]
    let ipa: [Pronunciation]?
    let audio: [Audio]?
}

struct Sense: Decodable, Hashable, Sendable {
    let glosses: [String]
    let tags: [String]?
    let topics: [String]?
    let qualifier: String?
    let formOf: [String]?
    let altOf: [String]?
    let examples: [Example]?

    enum CodingKeys: String, CodingKey {
        case glosses, tags, topics, qualifier, examples
        case formOf = "form_of"
        case altOf = "alt_of"
    }

    /// The gloss to show; earlier glosses are parent meanings.
    var gloss: String { glosses.last ?? "" }
    var parentGloss: String? { glosses.count > 1 ? glosses.first : nil }

    /// Words this sense points to ("past of go" -> ["go"]).
    var targets: [String] { (formOf ?? []) + (altOf ?? []) }

    /// Human-readable labels like "obsolete, informal, sports".
    var labels: [String] {
        var result: [String] = []
        if let qualifier { result.append(qualifier) }
        let isFormOf = !(formOf ?? []).isEmpty
        for tag in tags ?? [] where !Self.hiddenTags.contains(tag) {
            // "past of go" already says it's the past tense.
            if isFormOf && Self.grammaticalTags.contains(tag) { continue }
            result.append(tag.replacingOccurrences(of: "-", with: " "))
        }
        result.append(contentsOf: topics ?? [])
        var seen = Set<String>()
        return result.filter { seen.insert($0).inserted }
    }

    private static let hiddenTags: Set<String> = [
        "form-of", "alt-of", "no-gloss", "morpheme",
    ]

    private static let grammaticalTags: Set<String> = [
        "past", "present", "participle", "simple", "plural", "singular", "third-person",
        "first-person", "second-person", "comparative", "superlative", "indicative",
        "infinitive", "gerund", "possessive", "subjunctive", "imperative", "tense",
    ]
}

struct Example: Decodable, Hashable, Sendable {
    let text: String
    let translation: String?
}

struct Pronunciation: Decodable, Hashable, Sendable {
    let ipa: String
    let tags: [String]?
}

struct Audio: Decodable, Hashable, Sendable {
    let url: URL
    let file: String?
    let tags: [String]?
}

/// Short accent label for pronunciation tags ("Received-Pronunciation" -> "UK").
enum AccentLabel {
    static func label(for tags: [String]?) -> String? {
        guard let tags, !tags.isEmpty else { return nil }
        let mapped = tags.map { tag -> String in
            switch tag {
            case "Received-Pronunciation", "UK", "British": return "UK"
            case "General-American", "US": return "US"
            default: return tag.replacingOccurrences(of: "-", with: " ")
            }
        }
        var seen = Set<String>()
        return mapped.filter { seen.insert($0).inserted }.joined(separator: ", ")
    }
}

enum PartOfSpeech {
    static func displayName(_ pos: String) -> String {
        switch pos {
        case "adj": "adjective"
        case "adv": "adverb"
        case "name": "proper noun"
        case "prep": "preposition"
        case "conj": "conjunction"
        case "pron": "pronoun"
        case "intj": "interjection"
        case "num": "numeral"
        case "det": "determiner"
        case "abbrev": "abbreviation"
        case "prep_phrase": "prepositional phrase"
        default: pos.replacingOccurrences(of: "_", with: " ")
        }
    }
}

/// A numbered line in an entry: a top-level sense ("1") or a sub-sense ("1a").
struct OutlineItem: Hashable, Sendable {
    let number: String
    let isSubsense: Bool
    let gloss: String
    let labels: [String]
    /// nil for a parent heading that has no sense of its own.
    let sense: Sense?
}

extension EntryData {
    /// Turns Wiktionary's flat sense list (where sub-senses repeat their parent
    /// gloss) into a numbered outline without duplicated parents.
    func outline() -> [OutlineItem] {
        var items: [OutlineItem] = []
        var number = 0
        var head: String?
        var headLabels: Set<String> = []
        var subIndex = 0

        for sense in senses {
            if let parent = sense.parentGloss {
                if parent != head {
                    number += 1
                    subIndex = 0
                    head = parent
                    headLabels = []
                    items.append(OutlineItem(number: "\(number)", isSubsense: false,
                                             gloss: parent, labels: [], sense: nil))
                }
                let letter = Self.letter(subIndex)
                subIndex += 1
                items.append(OutlineItem(number: "\(number)\(letter)", isSubsense: true, gloss: sense.gloss,
                                         labels: sense.labels.filter { !headLabels.contains($0) },
                                         sense: sense))
            } else {
                number += 1
                subIndex = 0
                head = sense.gloss
                headLabels = Set(sense.labels)
                items.append(OutlineItem(number: "\(number)", isSubsense: false, gloss: sense.gloss,
                                         labels: sense.labels, sense: sense))
            }
        }
        return items
    }

    private static func letter(_ index: Int) -> String {
        let letters = Array("abcdefghijklmnopqrstuvwxyz")
        return index < letters.count ? String(letters[index]) : "\(index + 1)"
    }

    /// Broad /phonemic/ transcriptions when available, otherwise everything.
    var displayIPA: [Pronunciation] {
        let all = ipa ?? []
        let broad = all.filter { $0.ipa.hasPrefix("/") }
        return broad.isEmpty ? all : broad
    }
}
