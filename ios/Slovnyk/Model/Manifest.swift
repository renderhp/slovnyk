import Foundation

struct Manifest: Codable, Sendable {
    let manifestVersion: Int
    let dictionaries: [DictionaryInfo]

    static let url = URL(string: "https://github.com/renderhp/slovnyk/releases/latest/download/manifest.json")!

    static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }

    static var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}

/// A downloadable dictionary as listed in manifest.json.
struct DictionaryInfo: Codable, Hashable, Identifiable, Sendable {
    let lang: String
    let name: String
    let file: String
    let schemaVersion: Int
    let size: Int64
    let sha256: String
    let uncompressedSize: Int64
    let uncompressedSha256: String
    let entryCount: Int
    let buildDate: String
    let url: URL

    var id: String { lang }
}
