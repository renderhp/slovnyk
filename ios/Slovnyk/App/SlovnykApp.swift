import SwiftUI

@main
struct SlovnykApp: App {
    @State private var library = DictionaryLibrary()
    @State private var audio = AudioPlayer()
    @State private var recents = RecentWords()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(library)
                .environment(audio)
                .environment(recents)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}

enum Theme {
    static let accent = Color(red: 0.96, green: 0.73, blue: 0.42)
    static let headword = Font.system(.largeTitle, design: .serif).weight(.bold)
}

/// Debug launch arguments, e.g. `-search went`, `-word go`, `-autoInstall en`.
enum LaunchOptions {
    static var search: String? { UserDefaults.standard.string(forKey: "search") }
    static var word: String? { UserDefaults.standard.string(forKey: "word") }
    static var autoInstall: String? { UserDefaults.standard.string(forKey: "autoInstall") }
    static var showLibrary: Bool { UserDefaults.standard.bool(forKey: "showLibrary") }
}
