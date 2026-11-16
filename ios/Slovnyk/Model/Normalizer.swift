import Foundation

/// Builds search keys. Must match `normalize()` in pipeline/build.py:
/// NFKD, drop combining marks, lowercase, unify apostrophes, collapse whitespace.
enum Normalizer {
    static func normalize(_ string: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in string.decomposedStringWithCompatibilityMapping.unicodeScalars
        where scalar.properties.canonicalCombiningClass == .notReordered {
            scalars.append(scalar)
        }
        let lowered = String(scalars).lowercased()
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
        return lowered.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
