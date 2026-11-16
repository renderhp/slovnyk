import Foundation
import Observation

/// Tracks available and installed dictionaries, and owns the open database.
@MainActor
@Observable
final class DictionaryLibrary {
    enum ManifestState: Equatable {
        case idle, loading, loaded, failed(String)
    }

    enum InstallState: Equatable {
        case downloading(Double)
        case installing
        case failed(String)
    }

    private(set) var available: [DictionaryInfo] = []
    private(set) var manifestState: ManifestState = .idle
    private(set) var installed: [String: DictionaryInfo] = [:]
    private(set) var installStates: [String: InstallState] = [:]
    private(set) var database: DictionaryDatabase?
    private(set) var openError: String?

    var activeLang: String? {
        didSet {
            UserDefaults.standard.set(activeLang, forKey: "activeLang")
            openActiveDatabase()
        }
    }

    private let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? URL.applicationSupportDirectory.appending(path: "Dictionaries")
        installed = loadInstalled()
        let stored = UserDefaults.standard.string(forKey: "activeLang")
        activeLang = stored.flatMap { installed[$0] != nil ? $0 : nil } ?? installed.keys.sorted().first
        openActiveDatabase()
    }

    var activeInfo: DictionaryInfo? { activeLang.flatMap { installed[$0] } }

    /// Manifest dictionaries plus installed ones missing from it (e.g. when offline).
    var listed: [DictionaryInfo] {
        let manifestLangs = Set(available.map(\.lang))
        let extra = installed.values.filter { !manifestLangs.contains($0.lang) }
        return available + extra.sorted { $0.name < $1.name }
    }

    func hasUpdate(_ lang: String) -> Bool {
        guard let installed = installed[lang],
              let latest = available.first(where: { $0.lang == lang }) else { return false }
        return latest.buildDate != installed.buildDate
    }

    // MARK: - Manifest

    func loadManifest() async {
        guard manifestState != .loading else { return }
        manifestState = .loading
        do {
            var request = URLRequest(url: Manifest.url)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let manifest = try Manifest.decoder.decode(Manifest.self, from: data)
            available = manifest.dictionaries
                .filter { $0.schemaVersion <= DictionaryDatabase.supportedSchemaVersion }
            manifestState = .loaded
        } catch {
            manifestState = .failed("Couldn't load the dictionary list. Check your connection.")
        }
    }

    // MARK: - Install / remove

    func install(_ info: DictionaryInfo) async {
        if case .downloading = installStates[info.lang] { return }
        if installStates[info.lang] == .installing { return }
        installStates[info.lang] = .downloading(0)
        do {
            let lang = info.lang
            let downloaded = try await Downloader.download(info.url) { [weak self] fraction in
                Task { @MainActor in
                    guard let self, case .downloading = self.installStates[lang] else { return }
                    self.installStates[lang] = .downloading(fraction)
                }
            }
            installStates[lang] = .installing
            let destination = fileURL(for: lang)
            try await Task.detached(priority: .userInitiated) {
                try Installer.install(downloaded: downloaded, info: info, to: destination)
            }.value
            installed[lang] = info
            saveInstalled()
            installStates[lang] = nil
            if activeLang == nil || activeLang == lang {
                activeLang = lang // reopens the database
            }
        } catch {
            installStates[info.lang] = .failed(error.localizedDescription)
        }
    }

    func remove(_ lang: String) {
        if activeLang == lang { database = nil }
        try? FileManager.default.removeItem(at: fileURL(for: lang))
        installed[lang] = nil
        saveInstalled()
        if activeLang == lang {
            activeLang = installed.keys.sorted().first
        }
    }

    // MARK: - Storage

    private func fileURL(for lang: String) -> URL {
        directory.appending(path: "\(lang).sqlite")
    }

    private var installedFile: URL { directory.appending(path: "installed.json") }

    private func openActiveDatabase() {
        database = nil
        openError = nil
        guard let lang = activeLang else { return }
        do {
            database = try DictionaryDatabase(url: fileURL(for: lang))
        } catch {
            openError = error.localizedDescription
        }
    }

    private func loadInstalled() -> [String: DictionaryInfo] {
        guard let data = try? Data(contentsOf: installedFile),
              let list = try? Manifest.decoder.decode([DictionaryInfo].self, from: data) else { return [:] }
        let existing = list.filter { FileManager.default.fileExists(atPath: fileURL(for: $0.lang).path) }
        return Dictionary(existing.map { ($0.lang, $0) }, uniquingKeysWith: { _, last in last })
    }

    private func saveInstalled() {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let list = installed.values.sorted { $0.lang < $1.lang }
            try Manifest.encoder.encode(list).write(to: installedFile, options: .atomic)
        } catch {
            assertionFailure("Failed to save installed dictionaries: \(error)")
        }
    }
}
