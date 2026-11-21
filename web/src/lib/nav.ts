// A navigation stack of word pages on top of the search screen, synced with browser history
// so the back button / gesture works.
import { signal } from '@preact/signals'

export const stack = signal<string[]>([])

const wordHash = (word: string) => `#/word/${encodeURIComponent(word)}`

export function pushWord(word: string) {
  const next = [...stack.value, word]
  history.pushState({ depth: next.length, stack: next }, '', wordHash(word))
  stack.value = next
}

export function back() {
  if (stack.value.length) history.back()
}

export function startNavigation(initialWord?: string | null) {
  const match = location.hash.match(/^#\/word\/(.+)$/)
  const word = initialWord ?? (match ? decodeURIComponent(match[1]) : null)
  history.replaceState({ depth: 0, stack: [] }, '', '#/')
  if (word) pushWord(word)

  window.addEventListener('popstate', (event: PopStateEvent) => {
    const state = event.state as { stack?: string[] } | null
    stack.value = state?.stack ?? []
  })
}
