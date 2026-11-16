import Compression
import CryptoKit
import Foundation

enum InstallError: LocalizedError {
    case checksumMismatch
    case decompressionFailed

    var errorDescription: String? {
        switch self {
        case .checksumMismatch: "The downloaded file is damaged. Please try again."
        case .decompressionFailed: "Couldn't unpack the dictionary."
        }
    }
}

/// Verifies and unpacks a downloaded `.sqlite.xz` into its final location.
enum Installer {
    static func install(downloaded: URL, info: DictionaryInfo, to destination: URL) throws {
        let fileManager = FileManager.default
        defer { try? fileManager.removeItem(at: downloaded) }

        guard try sha256(of: downloaded) == info.sha256 else { throw InstallError.checksumMismatch }

        try fileManager.createDirectory(at: destination.deletingLastPathComponent(),
                                        withIntermediateDirectories: true)
        let partial = destination.appendingPathExtension("partial")
        try? fileManager.removeItem(at: partial)
        defer { try? fileManager.removeItem(at: partial) }
        try decompress(downloaded, to: partial)
        guard try sha256(of: partial) == info.uncompressedSha256 else { throw InstallError.checksumMismatch }

        _ = try DictionaryDatabase(url: partial) // make sure it opens and the schema is supported

        if fileManager.fileExists(atPath: destination.path) {
            _ = try fileManager.replaceItemAt(destination, withItemAt: partial)
        } else {
            try fileManager.moveItem(at: partial, to: destination)
        }
        var url = destination
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try url.setResourceValues(values)
    }

    static func decompress(_ source: URL, to destination: URL) throws {
        guard FileManager.default.createFile(atPath: destination.path, contents: nil) else {
            throw InstallError.decompressionFailed
        }
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }

        var writeError: Error?
        let filter = try OutputFilter(.decompress, using: .lzma) { data in
            guard let data, writeError == nil else { return }
            do { try output.write(contentsOf: data) } catch { writeError = error }
        }
        while true {
            let chunk = try input.read(upToCount: 1 << 20) ?? Data()
            try filter.write(chunk)
            if let writeError { throw writeError }
            if chunk.isEmpty { break }
        }
        try filter.finalize()
    }

    static func sha256(of url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while let chunk = try handle.read(upToCount: 1 << 20), !chunk.isEmpty {
            hasher.update(data: chunk)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }
}
