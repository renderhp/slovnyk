import SwiftUI

/// The dictionaries sheet shown from the search screen.
struct LibrarySheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            LibraryList(showsHeader: false)
                .navigationTitle("Dictionaries")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
    }
}

/// List of available and installed dictionaries, used in onboarding and the sheet.
struct LibraryList: View {
    var showsHeader = true
    @Environment(DictionaryLibrary.self) private var library

    var body: some View {
        List {
            Section {
                ForEach(library.listed) { info in
                    DictionaryRow(info: info)
                }
                if library.listed.isEmpty {
                    manifestStatus
                }
            } header: {
                if showsHeader { Text("Dictionaries") }
            } footer: {
                if !library.listed.isEmpty, case .failed(let message) = library.manifestState {
                    Text(message)
                }
            }

            Section {
                NavigationLink("About & licenses") { AboutView() }
            }
        }
        .task { await library.loadManifest() }
        .refreshable { await library.loadManifest() }
    }

    @ViewBuilder
    private var manifestStatus: some View {
        switch library.manifestState {
        case .failed(let message):
            VStack(alignment: .leading, spacing: 8) {
                Text(message).foregroundStyle(.secondary)
                Button("Try again") { Task { await library.loadManifest() } }
            }
        default:
            HStack {
                ProgressView()
                Text("Loading…").foregroundStyle(.secondary).padding(.leading, 6)
            }
        }
    }
}

private struct DictionaryRow: View {
    let info: DictionaryInfo
    @Environment(DictionaryLibrary.self) private var library
    @State private var confirmingDelete = false

    private var isInstalled: Bool { library.installed[info.lang] != nil }
    private var isActive: Bool { library.activeLang == info.lang }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(info.name).font(.body.weight(.semibold))
                    if isActive && library.installed.count > 1 {
                        Image(systemName: "checkmark").font(.caption.bold()).foregroundStyle(Theme.accent)
                    }
                }
                Text(details)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                stateView
            }
            Spacer(minLength: 8)
            actionButton
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            if isInstalled { library.activeLang = info.lang }
        }
        .swipeActions {
            if isInstalled {
                Button("Delete", role: .destructive) { library.remove(info.lang) }
            }
        }
    }

    private var details: String {
        let entries = info.entryCount.formatted(.number.notation(.compactName))
        let download = ByteCountFormatter.string(fromByteCount: info.size, countStyle: .file)
        let disk = ByteCountFormatter.string(fromByteCount: info.uncompressedSize, countStyle: .file)
        if let installed = library.installed[info.lang] {
            return "\(entries) entries · \(disk) · updated \(Self.shortDate(installed.buildDate))"
        }
        return "\(entries) entries · \(download) download · \(disk) on device"
    }

    @ViewBuilder
    private var stateView: some View {
        switch library.installStates[info.lang] {
        case .downloading(let fraction):
            ProgressView(value: fraction) {
                Text("Downloading… \(Int(fraction * 100))%").font(.caption)
            }
            .padding(.top, 2)
        case .installing:
            HStack(spacing: 6) {
                ProgressView().controlSize(.small)
                Text("Installing…").font(.caption).foregroundStyle(.secondary)
            }
        case .failed(let message):
            Text(message).font(.caption).foregroundStyle(.red)
        case nil:
            EmptyView()
        }
    }

    @ViewBuilder
    private var actionButton: some View {
        let busy = library.installStates[info.lang].map { state in
            if case .failed = state { return false }
            return true
        } ?? false
        if busy {
            EmptyView()
        } else if !isInstalled {
            Button("Get") { Task { await library.install(info) } }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .foregroundStyle(.black)
        } else if library.hasUpdate(info.lang) {
            Button("Update") {
                if let latest = library.available.first(where: { $0.lang == info.lang }) {
                    Task { await library.install(latest) }
                }
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
        } else {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(Theme.accent)
                .accessibilityLabel("Installed")
        }
    }

    private static func shortDate(_ iso: String) -> String {
        guard let date = try? Date(iso, strategy: .iso8601) else { return iso }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

struct AboutView: View {
    @Environment(DictionaryLibrary.self) private var library

    var body: some View {
        List {
            Section {
                Text("Slovnyk is a free, offline dictionary built on Wiktionary, the free dictionary written by volunteers.")
            }
            Section("Dictionary data") {
                Text("Content from Wiktionary by Wiktionary contributors, extracted with Wiktextract (kaikki.org) and modified: filtered, restructured and converted for offline use.")
                Link("Wiktionary", destination: URL(string: "https://www.wiktionary.org")!)
                Link("kaikki.org / Wiktextract", destination: URL(string: "https://kaikki.org")!)
                Link("License: CC BY-SA 4.0", destination: URL(string: "https://creativecommons.org/licenses/by-sa/4.0/")!)
                if let source = library.database?.meta["source_last_modified"], !source.isEmpty {
                    LabeledContent("Source snapshot", value: source)
                }
            }
            Section("Pronunciation audio") {
                Text("Audio is streamed from Wikimedia Commons. Each recording has its own license, shown on its Commons page.")
            }
            Section("App") {
                Link("Source code on GitHub", destination: URL(string: "https://github.com/renderhp/slovnyk")!)
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "–")
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }
}
