import { useEffect, useRef, useState } from 'preact/hooks'
import {
  activeLang,
  activeMeta,
  hasUpdate,
  install,
  installed,
  installStates,
  listed,
  loadManifest,
  manifestState,
  remove,
  setActive,
  available,
  type DictionaryInfo,
} from '../lib/library'
import { BackIcon, CheckCircleIcon, ChevronIcon } from './icons'
import { bytes, compactNumber, shortDate } from './format'

/** List of available and installed dictionaries, plus the About link. */
export function LibraryList({ showsHeader = true, onAbout }: { showsHeader?: boolean; onAbout: () => void }) {
  useEffect(() => {
    loadManifest()
  }, [])
  const state = manifestState.value
  const items = listed.value

  return (
    <div class="grouped">
      {showsHeader && <div class="group-header">Dictionaries</div>}
      <div class="group">
        {items.map((info) => (
          <DictionaryRow key={info.lang} info={info} />
        ))}
        {items.length === 0 &&
          (typeof state === 'object' ? (
            <div class="row column">
              <span class="muted">{state.failed}</span>
              <button class="text-button" onClick={loadManifest}>
                Try again
              </button>
            </div>
          ) : (
            <div class="row">
              <span class="spinner" /> <span class="muted">Loading…</span>
            </div>
          ))}
      </div>
      {items.length > 0 && typeof state === 'object' && <div class="group-footer">{state.failed}</div>}

      <div class="group">
        <button class="row link-row" onClick={onAbout}>
          <span>About &amp; licenses</span>
          <ChevronIcon class="chevron" />
        </button>
      </div>
    </div>
  )
}

function DictionaryRow({ info }: { info: DictionaryInfo }) {
  const current = installed.value[info.lang]
  const state = installStates.value[info.lang]
  const busy = state && state.kind !== 'failed'
  const isActive = activeLang.value === info.lang
  const entries = compactNumber(info.entry_count)

  const details = current
    ? `${entries} entries · ${bytes(current.uncompressed_size)} · updated ${shortDate(current.build_date)}`
    : `${entries} entries · ${bytes(info.size)} download · ${bytes(info.uncompressed_size)} on device`

  return (
    <div class="row dictionary-row" onClick={() => current && setActive(info.lang)}>
      <div class="dictionary-text">
        <div class="dictionary-name">
          {info.name}
          {isActive && Object.keys(installed.value).length > 1 && <span class="accent"> ✓</span>}
        </div>
        <div class="caption">{details}</div>
        {state?.kind === 'downloading' && (
          <div class="progress">
            <div class="caption-strong">Downloading… {Math.floor(state.fraction * 100)}%</div>
            <div class="progress-track">
              <div class="progress-bar" style={{ width: `${state.fraction * 100}%` }} />
            </div>
          </div>
        )}
        {state?.kind === 'installing' && (
          <div class="installing">
            <span class="spinner small" /> <span class="caption">Installing…</span>
          </div>
        )}
        {state?.kind === 'failed' && <div class="error">{state.message}</div>}
        {current && !busy && (
          <button
            class="text-button danger small"
            onClick={(e) => {
              e.stopPropagation()
              if (confirmRemoval(info.name)) remove(info.lang)
            }}
          >
            Delete
          </button>
        )}
      </div>
      {!busy &&
        (!current ? (
          <button
            class="pill-button"
            onClick={(e) => {
              e.stopPropagation()
              install(info)
            }}
          >
            Get
          </button>
        ) : hasUpdate(info.lang) ? (
          <button
            class="pill-button outline"
            onClick={(e) => {
              e.stopPropagation()
              const latest = available.value.find((d) => d.lang === info.lang)
              if (latest) install(latest)
            }}
          >
            Update
          </button>
        ) : (
          <CheckCircleIcon class="accent" />
        ))}
    </div>
  )
}

// A two-tap confirmation without browser dialogs.
let pendingRemoval: { name: string; until: number } | null = null
function confirmRemoval(name: string): boolean {
  const now = Date.now()
  if (pendingRemoval?.name === name && pendingRemoval.until > now) {
    pendingRemoval = null
    return true
  }
  pendingRemoval = { name, until: now + 3000 }
  showToast(`Tap Delete again to remove ${name}`)
  return false
}

function showToast(message: string) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2800)
}

export function AboutPage({ onBack }: { onBack: () => void }) {
  const source = activeMeta.value?.source_last_modified
  return (
    <div class="screen">
      <header class="topbar">
        <div class="topbar-side">
          <button class="circle-button" aria-label="Back" onClick={onBack}>
            <BackIcon />
          </button>
        </div>
        <h1 class="topbar-title">About</h1>
        <div class="topbar-side" />
      </header>
      <div class="scroll">
        <div class="grouped">
          <div class="group">
            <div class="row text">
              Slovnyk is a free, offline dictionary built on Wiktionary, the free dictionary written by volunteers.
            </div>
          </div>
          <div class="group-header">Dictionary data</div>
          <div class="group">
            <div class="row text">
              Content from Wiktionary by Wiktionary contributors, extracted with Wiktextract (kaikki.org) and
              modified: filtered, restructured and converted for offline use.
            </div>
            <a class="row link" href="https://www.wiktionary.org" target="_blank" rel="noopener">Wiktionary</a>
            <a class="row link" href="https://kaikki.org" target="_blank" rel="noopener">kaikki.org / Wiktextract</a>
            <a class="row link" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">
              License: CC BY-SA 4.0
            </a>
            {source && (
              <div class="row spread">
                <span>Source snapshot</span>
                <span class="muted">{source}</span>
              </div>
            )}
          </div>
          <div class="group-header">Pronunciation audio</div>
          <div class="group">
            <div class="row text">
              Audio is streamed from Wikimedia Commons. Each recording has its own license, shown on its Commons page.
            </div>
          </div>
          <div class="group-header">App</div>
          <div class="group">
            <a class="row link" href="https://github.com/renderhp/slovnyk" target="_blank" rel="noopener">
              Source code on GitHub
            </a>
            <div class="row spread">
              <span>Version</span>
              <span class="muted">{__APP_VERSION__}</span>
            </div>
            <div class="row spread">
              <span>Build</span>
              <span class="muted">
                {__BUILD_ID__} · {shortDate(__BUILD_DATE__)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The dictionaries sheet shown from the search screen. Drag down or tap outside to dismiss. */
export function LibrarySheet({ onClose }: { onClose: () => void }) {
  const [about, setAbout] = useState(false)
  const [closing, setClosing] = useState(false)
  const sheet = useRef<HTMLDivElement>(null)

  const close = () => {
    if (closing) return
    setClosing(true)
    setTimeout(onClose, 320)
  }

  // Drag the sheet down by its header (or anywhere while the list is scrolled to the top).
  useEffect(() => {
    const el = sheet.current
    if (!el) return
    let startY = 0
    let lastY = 0
    let lastT = 0
    let velocity = 0
    let tracking = false
    let dragging = false

    const scroller = () => el.querySelector<HTMLElement>('.scroll')
    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement
      const inHeader = !!target.closest('.topbar, .sheet-grabber')
      const atTop = (scroller()?.scrollTop ?? 0) <= 0
      if (!inHeader && !atTop) return
      if (target.closest('button, a, input')) return
      tracking = true
      dragging = false
      startY = lastY = e.touches[0].clientY
      lastT = e.timeStamp
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const y = e.touches[0].clientY
      const dy = y - startY
      if (!dragging) {
        if (dy < 6) {
          if (dy < -6) tracking = false
          return
        }
        dragging = true
      }
      e.preventDefault()
      velocity = (y - lastY) / Math.max(e.timeStamp - lastT, 1)
      lastY = y
      lastT = e.timeStamp
      el.style.transition = 'none'
      el.style.transform = `translate3d(0, ${Math.max(dy, 0)}px, 0)`
    }
    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (!dragging) return
      const dy = lastY - startY
      el.style.transition = ''
      if (dy > el.clientHeight * 0.25 || velocity > 0.5) {
        el.style.transform = 'translate3d(0, 100%, 0)'
        close()
      } else {
        el.style.transform = ''
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return (
    <div class={`sheet-backdrop${closing ? ' closing' : ''}`} onClick={close}>
      <div class={`sheet${closing ? ' closing' : ''}`} ref={sheet} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-grabber" />
        {about ? (
          <AboutPage onBack={() => setAbout(false)} />
        ) : (
          <div class="screen">
            <header class="topbar sheet-topbar">
              <div class="topbar-side" />
              <h1 class="topbar-title">Dictionaries</h1>
              <div class="topbar-side right">
                <button class="done-button" onClick={close}>
                  Done
                </button>
              </div>
            </header>
            <div class="scroll">
              <LibraryList showsHeader={false} onAbout={() => setAbout(true)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
