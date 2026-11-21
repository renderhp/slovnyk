// A navigation stack of word pages on top of the search screen, synced with browser
// history so the browser's back button / gesture works too.
import { signal } from '@preact/signals'

export const stack = signal<string[]>([])

/** How the most recent pop should look: slide out, or vanish because it's already gone. */
export type PopMode = 'animated' | 'instant'
export let lastPopMode: PopMode = 'animated'

let pendingPopMode: PopMode | null = null

/** In a regular iOS Safari tab the browser animates its own back swipe. */
const isStandalone =
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const browserAnimatesBack = !isStandalone && matchMedia('(pointer: coarse)').matches

const wordHash = (word: string) => `#/word/${encodeURIComponent(word)}`

export function pushWord(word: string) {
  const next = [...stack.value, word]
  history.pushState({ stack: next }, '', wordHash(word))
  stack.value = next
}

/** Goes back one page. `animated: false` when a swipe has already moved the page away. */
export function back(animated = true) {
  if (!stack.value.length) return
  pendingPopMode = animated ? 'animated' : 'instant'
  history.back()
}

export function startNavigation(initialWord?: string | null) {
  const match = location.hash.match(/^#\/word\/(.+)$/)
  const word = initialWord ?? (match ? decodeURIComponent(match[1]) : null)
  history.replaceState({ stack: [] }, '', '#/')
  if (word) pushWord(word)

  window.addEventListener('popstate', (event: PopStateEvent) => {
    lastPopMode = pendingPopMode ?? (browserAnimatesBack ? 'instant' : 'animated')
    pendingPopMode = null
    const state = event.state as { stack?: string[] } | null
    stack.value = state?.stack ?? []
  })
}
