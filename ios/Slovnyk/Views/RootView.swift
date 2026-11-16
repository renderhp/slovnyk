import SwiftUI

struct RootView: View {
    @Environment(DictionaryLibrary.self) private var library

    var body: some View {
        Group {
            if let database = library.database {
                SearchView(database: database)
                    .id(database.url) // fresh state when the dictionary changes
            } else {
                OnboardingView()
            }
        }
        .task {
            guard let lang = LaunchOptions.autoInstall, library.installed[lang] == nil else { return }
            await library.loadManifest()
            if let info = library.available.first(where: { $0.lang == lang }) {
                await library.install(info)
            }
        }
    }
}

struct OnboardingView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                VStack(spacing: 8) {
                    Text("Slovnyk")
                        .font(.system(size: 44, weight: .bold, design: .serif))
                    Text("An offline dictionary built on Wiktionary.\nDownload a dictionary to get started.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 48)
                .padding(.bottom, 16)

                LibraryList()
            }
            .background(Color(.systemGroupedBackground))
        }
    }
}
