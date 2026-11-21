// Recently opened words, per dictionary, newest first.
import { signal } from '@preact/signals'

export interface Recent {
  word: string
  partsOfSpeech: string[]
  gloss: string | null
}

const LIMIT = 100
const key = (lang: string) => `slovnyk.recents.${lang}`

let currentLang: string | null = null
export const recents = signal<Recent[]>([])

export function loadRecents(lang: string | null) {
  currentLang = lang
  if (!lang) return void (recents.value = [])
  try {
    recents.value = JSON.parse(localStorage.getItem(key(lang)) ?? '[]')
  } catch {
    recents.value = []
  }
}

function save(next: Recent[]) {
  recents.value = next
  if (currentLang) localStorage.setItem(key(currentLang), JSON.stringify(next))
}

export function addRecent(item: Recent) {
  save([item, ...recents.value.filter((r) => r.word !== item.word)].slice(0, LIMIT))
}

export function removeRecent(word: string) {
  save(recents.value.filter((r) => r.word !== word))
}

export function clearRecents() {
  save([])
}
