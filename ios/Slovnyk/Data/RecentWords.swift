import Foundation
import Observation

/// A recently opened word, with enough to show it in a list.
struct RecentWord: Codable, Hashable, Identifiable, Sendable {
    let word: String
    let partsOfSpeech: [String]
    let gloss: String?

    var id: String { word }

    var asSearchResult: SearchResult {
        SearchResult(word: word, partsOfSpeech: partsOfSpeech, gloss: gloss, matchedForm: nil)
    }
}

/// Recently opened words, per dictionary, newest first (mirrors web/src/lib/recents.ts).
@MainActor
@Observable
final class RecentWords {
    static let limit = 100

    private(set) var items: [RecentWord] = []
    private var lang: String?
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    private func key(_ lang: String) -> String { "recents.\(lang)" }

    func load(lang: String?) {
        guard lang != self.lang else { return }
        self.lang = lang
        guard let lang, let data = defaults.data(forKey: key(lang)),
              let saved = try? JSONDecoder().decode([RecentWord].self, from: data) else {
            items = []
            return
        }
        items = saved
    }

    func add(_ item: RecentWord) {
        save([item] + items.filter { $0.word != item.word })
    }

    func remove(atOffsets offsets: IndexSet) {
        var next = items
        next.remove(atOffsets: offsets)
        save(next)
    }

    func clear() {
        save([])
    }

    private func save(_ next: [RecentWord]) {
        items = Array(next.prefix(Self.limit))
        guard let lang, let data = try? JSONEncoder().encode(items) else { return }
        defaults.set(data, forKey: key(lang))
    }
}
