import Foundation

/// A row in the search results list: one headword, possibly spanning several entries.
struct SearchResult: Identifiable, Hashable, Sendable {
    let word: String
    var partsOfSpeech: [String]
    var gloss: String?
    /// Set when the word was found through one of its forms (query "went" -> "go").
    var matchedForm: String?

    var id: String { word }
}

/// Read-only access to one downloaded dictionary.
final class DictionaryDatabase: Sendable {
    static let supportedSchemaVersion = 1

    let url: URL
    let meta: [String: String]
    private let connection: SQLiteConnection

    init(url: URL) throws {
        self.url = url
        connection = try SQLiteConnection(readOnly: url)
        let pairs = try connection.query("SELECT key, value FROM meta") { ($0.text(0) ?? "", $0.text(1) ?? "") }
        meta = Dictionary(pairs, uniquingKeysWith: { first, _ in first })
        guard let version = meta["schema_version"].flatMap(Int.init),
              version <= Self.supportedSchemaVersion else {
            throw SQLiteError(message: "Unsupported dictionary format")
        }
    }

    var entryCount: Int { meta["entry_count"].flatMap(Int.init) ?? 0 }

    // MARK: - Search

    private struct LookupRow {
        let norm: String
        let kind: Int64
        let word: String
        let pos: String
        let gloss: String?
    }

    private static let lookupColumns = """
        SELECT l.norm, l.kind, e.word, e.pos, json_extract(e.data, '$.senses[0].glosses[#-1]')
        FROM lookup l JOIN entries e ON e.id = l.entry_id
        """

    func search(_ query: String, limit: Int = 60) throws -> [SearchResult] {
        let key = Normalizer.normalize(query)
        guard !key.isEmpty else { return [] }
        let map: (SQLiteConnection.Row) -> LookupRow = {
            LookupRow(norm: $0.text(0) ?? "", kind: $0.int(1), word: $0.text(2) ?? "",
                      pos: $0.text(3) ?? "", gloss: $0.text(4))
        }

        let exact = try connection.query(
            Self.lookupColumns + " WHERE l.norm = ?1 ORDER BY e.id LIMIT 200", [key], map: map)
        let prefix = try connection.query(
            Self.lookupColumns + " WHERE l.norm > ?1 AND l.norm < ?2 ORDER BY l.norm, e.id LIMIT 400",
            [key, key + "\u{10FFFF}"], map: map)

        // Exact matches first: headwords before forms, the exact spelling before case variants.
        let typed = query.trimmingCharacters(in: .whitespaces)
        let rankedExact = exact.enumerated().sorted { a, b in
            let ra = (a.element.kind, a.element.word == typed ? 0 : 1, a.offset)
            let rb = (b.element.kind, b.element.word == typed ? 0 : 1, b.offset)
            return ra < rb
        }.map(\.element)

        var results: [SearchResult] = []
        var index: [String: Int] = [:]
        for row in rankedExact + prefix {
            if let i = index[row.word] {
                if !results[i].partsOfSpeech.contains(row.pos) { results[i].partsOfSpeech.append(row.pos) }
                if row.kind == 0 { results[i].matchedForm = nil }
                continue
            }
            guard results.count < limit else { continue }
            index[row.word] = results.count
            results.append(SearchResult(
                word: row.word,
                partsOfSpeech: [row.pos],
                gloss: row.gloss,
                matchedForm: row.kind == 1 ? row.norm : nil))
        }
        return results
    }

    // MARK: - Entries

    func entries(for word: String) throws -> [Entry] {
        let decoder = JSONDecoder()
        return try connection.query(
            """
            SELECT e.id, e.word, e.pos, e.data
            FROM lookup l JOIN entries e ON e.id = l.entry_id
            WHERE l.norm = ?1 AND l.kind = 0 AND e.word = ?2
            ORDER BY e.id
            """,
            [Normalizer.normalize(word), word]
        ) { row in
            Entry(id: row.int(0), word: row.text(1) ?? "", pos: row.text(2) ?? "",
                  data: try decoder.decode(EntryData.self, from: row.data(3)))
        }
    }
}
