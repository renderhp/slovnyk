import SwiftUI

struct WordView: View {
    let word: String
    let database: DictionaryDatabase

    @State private var entries: [Entry] = []
    @State private var loaded = false
    @Environment(RecentWords.self) private var recents

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(word)
                        .font(Theme.headword)
                        .textSelection(.enabled)
                    PronunciationView(entries: entries)
                }

                ForEach(entries) { entry in
                    EntrySection(entry: entry)
                }

                if loaded && entries.isEmpty {
                    Text("No entry found.")
                        .foregroundStyle(.secondary)
                }

                if let url = wiktionaryURL {
                    Link(destination: url) {
                        Label("View on Wiktionary", systemImage: "arrow.up.right.square")
                            .font(.footnote)
                    }
                    .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .navigationBarTitleDisplayMode(.inline)
        .task(id: word) { await load() }
    }

    private var wiktionaryURL: URL? {
        let title = word.replacingOccurrences(of: " ", with: "_")
        guard let encoded = title.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else { return nil }
        return URL(string: "https://en.wiktionary.org/wiki/\(encoded)#English")
    }

    private func load() async {
        let database = database
        let word = word
        entries = (try? await Task.detached(priority: .userInitiated) {
            try database.entries(for: word)
        }.value) ?? []
        loaded = true
        if let first = entries.first {
            var seen = Set<String>()
            recents.add(RecentWord(
                word: word,
                partsOfSpeech: entries.map(\.pos).filter { seen.insert($0).inserted },
                gloss: first.data.senses.first?.gloss))
        }
    }
}

// MARK: - Pronunciation

private struct PronunciationView: View {
    let entries: [Entry]
    @Environment(AudioPlayer.self) private var audio

    var body: some View {
        let ipa = uniqueIPA
        let clips = uniqueAudio
        if !ipa.isEmpty || !clips.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                if !ipa.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(ipa, id: \.ipa) { item in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                if let label = item.label {
                                    Text(label)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Text(item.ipa)
                                    .font(.body)
                                    .foregroundStyle(Theme.accent)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                }
                if !clips.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(clips, id: \.url) { clip in
                            AudioButton(url: clip.url, label: clip.label)
                        }
                    }
                }
            }
        }
    }

    private var uniqueIPA: [(ipa: String, label: String?)] {
        var seen = Set<String>()
        var result: [(String, String?)] = []
        for entry in entries {
            for item in entry.data.displayIPA where seen.insert(item.ipa).inserted {
                result.append((item.ipa, AccentLabel.label(for: item.tags)))
            }
        }
        return Array(result.prefix(4))
    }

    private var uniqueAudio: [(url: URL, label: String)] {
        var seenURLs = Set<URL>()
        var seenLabels = Set<String>()
        var result: [(URL, String)] = []
        for entry in entries {
            for clip in entry.data.audio ?? [] where seenURLs.insert(clip.url).inserted {
                let label = AccentLabel.label(for: clip.tags) ?? "Listen"
                guard seenLabels.insert(label).inserted else { continue }
                result.append((clip.url, label))
            }
        }
        return Array(result.prefix(3))
    }
}

private struct AudioButton: View {
    let url: URL
    let label: String
    @Environment(AudioPlayer.self) private var audio

    var body: some View {
        let playing = audio.playingURL == url
        Button {
            playing ? audio.stop() : audio.play(url)
        } label: {
            Label(label, systemImage: audio.failedURL == url ? "exclamationmark.triangle"
                                    : playing ? "speaker.wave.2.fill" : "play.fill")
                .font(.footnote.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Theme.accent.opacity(0.15), in: Capsule())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.accent)
    }
}

// MARK: - Entry

private struct EntrySection: View {
    let entry: Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(PartOfSpeech.displayName(entry.pos))
                .font(.subheadline.weight(.semibold).italic())
                .foregroundStyle(Theme.accent)

            ForEach(entry.data.outline(), id: \.number) { item in
                SenseRow(item: item)
                    .padding(.leading, item.isSubsense ? 28 : 0)
            }
        }
    }
}

private struct SenseRow: View {
    let item: OutlineItem

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(item.number)
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.tertiary)
                .frame(minWidth: 22, alignment: .trailing)

            VStack(alignment: .leading, spacing: 6) {
                if !item.labels.isEmpty {
                    Text(item.labels.joined(separator: ", "))
                        .font(.caption.italic())
                        .foregroundStyle(.secondary)
                }
                Text(item.gloss)
                    .font(.body)
                    .foregroundStyle(item.sense == nil ? .secondary : .primary)
                    .textSelection(.enabled)

                if let sense = item.sense {
                    if !sense.targets.isEmpty {
                        HStack(spacing: 12) {
                            ForEach(sense.targets, id: \.self) { target in
                                NavigationLink(value: WordRoute(word: target)) {
                                    Label(target, systemImage: "arrow.turn.down.right")
                                        .font(.subheadline.weight(.medium))
                                }
                            }
                        }
                    }
                    ForEach(sense.examples ?? [], id: \.self) { example in
                        ExampleView(example: example)
                    }
                }
            }
        }
    }
}

private struct ExampleView: View {
    let example: Example

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(example.text)
                .italic()
            if let translation = example.translation {
                Text(translation)
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            }
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .padding(.leading, 10)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.accent.opacity(0.4))
                .frame(width: 2)
        }
        .textSelection(.enabled)
    }
}
