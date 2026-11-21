import Foundation

/// Builds search keys. Must match `normalize()` in pipeline/build.py:
/// NFC; drop combining marks (stress, accents) from every character except `keepLetters`,
/// using NFKD; lowercase; unify apostrophes; collapse whitespace.
enum Normalizer {
    /// Separate letters that look like letter + mark (Ukrainian й ї, Russian ё, Belarusian ў).
    private static let keepLetters = Set("йЙїЇёЁўЎ".unicodeScalars)

    static func normalize(_ string: String) -> String {
        var scalars = String.UnicodeScalarView()
        for scalar in string.precomposedStringWithCanonicalMapping.unicodeScalars {
            if keepLetters.contains(scalar) {
                scalars.append(scalar)
                continue
            }
            for part in String(scalar).decomposedStringWithCompatibilityMapping.unicodeScalars
            where part.properties.canonicalCombiningClass == .notReordered {
                scalars.append(part)
            }
        }
        let lowered = String(scalars).lowercased()
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "\u{2018}", with: "'")
        return lowered.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
