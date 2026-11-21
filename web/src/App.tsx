import { useEffect, useState } from 'preact/hooks'
import { activeMeta, available, install, installed, loadManifest, ready, startupError, waitingForOtherTab } from './lib/library'
import { AboutPage, LibraryList, LibrarySheet } from './ui/Library'
import { SearchScreen } from './ui/SearchScreen'
import { NavStack } from './ui/NavStack'

/** Debug options via the URL, e.g. ?search=went, ?word=go, ?autoInstall=en, ?library=1 */
export const params = new URLSearchParams(location.search)

export function App() {
  const [libraryOpen, setLibraryOpen] = useState(params.has('library'))

  useEffect(() => {
    const lang = params.get('autoInstall')
    if (!ready.value || !lang || installed.value[lang]) return
    loadManifest().then(() => {
      const info = available.value.find((d) => d.lang === lang)
      if (info) install(info)
    })
  }, [ready.value])

  if (!ready.value) {
    return (
      <div class="app">
        {waitingForOtherTab.value && (
          <div class="screen center-message">
            <h1 class="onboarding-title">Slovnyk</h1>
            <p class="onboarding-subtitle">
              Slovnyk is open in another tab or window.
              <br />
              Close it and this one will continue.
            </p>
          </div>
        )}
      </div>
    )
  }

  if (!activeMeta.value) return <Onboarding />

  return (
    <div class="app">
      <NavStack
        inert={libraryOpen}
        base={
          <SearchScreen onOpenLibrary={() => setLibraryOpen(true)} initialQuery={params.get('search') ?? undefined} />
        }
      />
      {libraryOpen && <LibrarySheet onClose={() => setLibraryOpen(false)} />}
    </div>
  )
}

function Onboarding() {
  const [about, setAbout] = useState(false)
  if (about) {
    return (
      <div class="app">
        <AboutPage onBack={() => setAbout(false)} />
      </div>
    )
  }
  return (
    <div class="app">
      <div class="screen">
        <div class="scroll">
          <div class="onboarding">
            <div class="onboarding-hero">
              <h1 class="onboarding-title">Slovnyk</h1>
              <p class="onboarding-subtitle">
                An offline dictionary built on Wiktionary.
                <br />
                Download a dictionary to get started.
              </p>
            </div>
            {startupError.value && <div class="banner-error">{startupError.value}</div>}
            <LibraryList onAbout={() => setAbout(true)} />
          </div>
        </div>
      </div>
    </div>
  )
}
