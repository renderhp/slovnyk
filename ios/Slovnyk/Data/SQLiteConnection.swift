import Foundation
import SQLite3

struct SQLiteError: Error, LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Minimal read-only SQLite wrapper. Calls are serialized with a lock.
final class SQLiteConnection: @unchecked Sendable {
    private var db: OpaquePointer?
    private let lock = NSLock()

    init(readOnly url: URL) throws {
        // immutable=1: the file never changes while open, so SQLite skips locking.
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.scheme = "file"
        components.queryItems = [URLQueryItem(name: "immutable", value: "1")]
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_URI | SQLITE_OPEN_NOMUTEX
        let code = sqlite3_open_v2(components.string!, &db, flags, nil)
        guard code == SQLITE_OK else {
            let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "code \(code)"
            sqlite3_close(db)
            throw SQLiteError(message: "Can't open database: \(message)")
        }
    }

    deinit {
        sqlite3_close(db)
    }

    struct Row {
        fileprivate let statement: OpaquePointer

        func int(_ column: Int32) -> Int64 { sqlite3_column_int64(statement, column) }

        func text(_ column: Int32) -> String? {
            guard let pointer = sqlite3_column_text(statement, column) else { return nil }
            return String(cString: pointer)
        }

        func data(_ column: Int32) -> Data {
            guard let bytes = sqlite3_column_blob(statement, column) else { return Data() }
            return Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, column)))
        }
    }

    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    func query<T>(_ sql: String, _ arguments: [String] = [], map: (Row) throws -> T) throws -> [T] {
        lock.lock()
        defer { lock.unlock() }

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw SQLiteError(message: String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        for (index, argument) in arguments.enumerated() {
            sqlite3_bind_text(statement, Int32(index + 1), argument, -1, Self.transient)
        }

        var results: [T] = []
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_DONE { break }
            guard code == SQLITE_ROW else {
                throw SQLiteError(message: String(cString: sqlite3_errmsg(db)))
            }
            results.append(try map(Row(statement: statement)))
        }
        return results
    }
}
