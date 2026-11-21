// Shown when Slovnyk is opened in a browser tab instead of as an installed app.
import { useEffect, useState } from 'preact/hooks'
import {
  allowBrowserUse,
  canPromptInstall,
  isAndroid,
  isIOS,
  isMacSafari,
  onInstallPromptChange,
  promptInstall,
} from '../lib/platform'

const iconUrl = new URL('apple-touch-icon.png', document.baseURI).href

export function InstallPage({ onContinue }: { onContinue: () => void }) {
  const [promptReady, setPromptReady] = useState(canPromptInstall())
  const [installed, setInstalled] = useState(false)

  useEffect(() => onInstallPromptChange(() => setPromptReady(canPromptInstall())), [])
  useEffect(() => {
    const done = () => setInstalled(true)
    addEventListener('appinstalled', done)
    return () => removeEventListener('appinstalled', done)
  }, [])

  return (
    <div class="app">
      <div class="screen">
        <div class="scroll">
          <div class="install">
            <img class="install-icon" src={iconUrl} alt="" width={96} height={96} />
            <h1 class="onboarding-title">Slovnyk</h1>
            <p class="onboarding-subtitle">
              A free, offline dictionary built on Wiktionary.
              <br />
              Install it as an app to get started.
            </p>

            {installed ? (
              <div class="install-card">
                <p class="install-done">Installed. Open Slovnyk from your {isIOS || isAndroid ? 'home screen' : 'apps'}.</p>
              </div>
            ) : promptReady ? (
              <div class="install-card center">
                <button
                  class="pill-button big"
                  onClick={async () => {
                    if (await promptInstall()) setInstalled(true)
                  }}
                >
                  Install Slovnyk
                </button>
              </div>
            ) : (
              <div class="install-card">
                <Steps />
              </div>
            )}

            <ul class="install-notes">
              <li>Works fully offline once a dictionary is downloaded (English is about 95 MB).</li>
              <li>No account, no ads, no tracking.</li>
              {isIOS && <li>Download dictionaries inside the installed app. Safari and the app don’t share storage.</li>}
            </ul>

            {!isIOS && !isAndroid && (
              <button
                class="text-button install-skip"
                onClick={() => {
                  allowBrowserUse()
                  onContinue()
                }}
              >
                Use in the browser anyway
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Steps() {
  if (isIOS) {
    return (
      <ol class="install-steps">
        <li>
          <Num n={1} />
          <span>
            Open this page in <b>Safari</b>, then tap <b>•••</b> and <b>Share</b> <ShareIcon />
            <span class="muted"> (or the Share button directly on older iOS).</span>
          </span>
        </li>
        <li>
          <Num n={2} />
          <span>
            Scroll down and tap <b>Add to Home Screen</b> <AddIcon />
          </span>
        </li>
        <li>
          <Num n={3} />
          <span>
            Keep <b>Open as Web App</b> on and tap <b>Add</b>.
          </span>
        </li>
        <li>
          <Num n={4} />
          <span>
            Open <b>Slovnyk</b> from your home screen.
          </span>
        </li>
      </ol>
    )
  }
  if (isAndroid) {
    return (
      <ol class="install-steps">
        <li>
          <Num n={1} />
          <span>
            Open the browser menu <b>⋮</b>.
          </span>
        </li>
        <li>
          <Num n={2} />
          <span>
            Tap <b>Install app</b> or <b>Add to Home screen</b>.
          </span>
        </li>
        <li>
          <Num n={3} />
          <span>
            Open <b>Slovnyk</b> from your home screen.
          </span>
        </li>
      </ol>
    )
  }
  if (isMacSafari) {
    return (
      <ol class="install-steps">
        <li>
          <Num n={1} />
          <span>
            In the menu bar choose <b>File → Add to Dock…</b>
          </span>
        </li>
        <li>
          <Num n={2} />
          <span>
            Click <b>Add</b>, then open <b>Slovnyk</b> from the Dock.
          </span>
        </li>
      </ol>
    )
  }
  return (
    <ol class="install-steps">
      <li>
        <Num n={1} />
        <span>
          In Chrome or Edge, click the <b>install</b> icon in the address bar, or open the menu and choose{' '}
          <b>Install Slovnyk</b>.
        </span>
      </li>
      <li>
        <Num n={2} />
        <span>
          Open <b>Slovnyk</b> from your apps.
        </span>
      </li>
    </ol>
  )
}

const Num = ({ n }: { n: number }) => <span class="step-number">{n}</span>

const ShareIcon = () => (
  <svg class="inline-icon" width="16" height="18" viewBox="0 0 16 20" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-label="Share">
    <path d="M8 12V1.5M4.5 5 8 1.5 11.5 5" />
    <path d="M5 8H3a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 3 18h10a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13 8h-2" />
  </svg>
)

const AddIcon = () => (
  <svg class="inline-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" aria-label="Add">
    <rect x="2" y="2" width="16" height="16" rx="4" />
    <path d="M10 6.5v7M6.5 10h7" />
  </svg>
)
