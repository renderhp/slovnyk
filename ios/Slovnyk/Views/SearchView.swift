import SwiftUI

struct WordRoute: Hashable {
    let word: String
}

struct SearchView: View {
    let database: DictionaryDatabase

    @Environment(DictionaryLibrary.self) private var library
    @State private var query = ""
    @State private var results: [SearchResult] = []
    @State private var searchedQuery = ""
    @State private var path = NavigationPath()
    @State private var showingLibrary = false

    var body: some View {
        NavigationStack(path: $path) {
            content
                .navigationTitle("Slovnyk")
                .navigationBarTitleDisplayMode(.inline)
                .searchable(text: $query,
                            placement: .navigationBarDrawer(displayMode: .always),
                            prompt: "Search \(library.activeInfo?.name ?? "")")
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .onSubmit(of: .search) {
                    if let first = results.first { path.append(WordRoute(word: first.word)) }
                }
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Dictionaries", systemImage: "books.vertical") { showingLibrary = true }
                    }
                }
                .navigationDestination(for: WordRoute.self) { route in
                    WordView(word: route.word, database: database)
                }
        }
        .sheet(isPresented: $showingLibrary) { LibrarySheet() }
        .task(id: query) { await runSearch() }
        .onAppear(perform: applyLaunchOptions)
    }

    @ViewBuilder
    private var content: some View {
        if query.trimmingCharacters(in: .whitespaces).isEmpty {
            EmptySearchView(info: library.activeInfo)
        } else if results.isEmpty && searchedQuery == query {
            ContentUnavailableView.search(text: query)
        } else {
            List(results) { result in
                NavigationLink(value: WordRoute(word: result.word)) {
                    SearchResultRow(result: result)
                }
            }
            .listStyle(.plain)
            .scrollDismissesKeyboard(.immediately)
        }
    }

    private func runSearch() async {
        let current = query
        guard !current.trimmingCharacters(in: .whitespaces).isEmpty else {
            results = []
            return
        }
        try? await Task.sleep(for: .milliseconds(100))
        guard !Task.isCancelled else { return }
        let database = database
        let found = (try? await Task.detached(priority: .userInitiated) {
            try database.search(current)
        }.value) ?? []
        guard !Task.isCancelled else { return }
        results = found
        searchedQuery = current
    }

    private func applyLaunchOptions() {
        if let search = LaunchOptions.search, query.isEmpty { query = search }
        if let word = LaunchOptions.word, path.isEmpty { path.append(WordRoute(word: word)) }
        if LaunchOptions.showLibrary { showingLibrary = true }
    }
}

private struct SearchResultRow: View {
    let result: SearchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(result.word)
                    .font(.body.weight(.semibold))
                Text(result.partsOfSpeech.map(PartOfSpeech.displayName).joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if let form = result.matchedForm {
                Text("form: \(form)")
                    .font(.caption)
                    .foregroundStyle(Theme.accent)
            }
            if let gloss = result.gloss {
                Text(gloss)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct EmptySearchView: View {
    let info: DictionaryInfo?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "character.book.closed")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.accent)
            Text("Look up a word")
                .font(.title3.weight(.semibold))
            if let info {
                Text("\(info.name) · \(info.entryCount.formatted(.number.notation(.compactName))) entries · offline")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.bottom, 80)
    }
}
