// Available/installed dictionaries and the active one (mirrors DictionaryLibrary.swift).
import { computed, signal } from '@preact/signals'
import { db } from './db'
import { loadRecents } from './recents'

export interface DictionaryInfo {
  lang: string
  name: string
  schema_version: number
  entry_count: number
  build_date: string
  /** Total download size (all gzip parts). */
  size: number
  uncompressed_size: number
  parts: { file: string; size: number }[]
}

export interface InstalledDictionary extends DictionaryInfo {
  /** File name inside the OPFS pool. */
  file: string
}

export type InstallState =
  | { kind: 'downloading'; fraction: number }
  | { kind: 'installing' }
  | { kind: 'failed'; message: string }

export type ManifestState = 'idle' | 'loading' | 'loaded' | { failed: string }

const MANIFEST_URL = new URL('data/manifest.json', document.baseURI).href
const STORAGE_KEY = 'slovnyk.installed'
const ACTIVE_KEY = 'slovnyk.activeLang'

export const available = signal<DictionaryInfo[]>([])
export const manifestState = signal<ManifestState>('idle')
export const installed = signal<Record<string, InstalledDictionary>>(loadInstalled())
export const installStates = signal<Record<string, InstallState>>({})
export const activeLang = signal<string | null>(null)
export const activeMeta = signal<Record<string, string> | null>(null)
/** True once storage is set up and the active dictionary (if any) is open. */
export const ready = signal(false)
export const startupError = signal<string | null>(null)
/** Another tab has the dictionaries open; we continue automatically once it closes. */
export const waitingForOtherTab = signal(false)

export const activeInfo = computed(() => (activeLang.value ? installed.value[activeLang.value] ?? null : null))

/** Manifest dictionaries plus installed ones missing from it (e.g. when offline). */
export const listed = computed(() => {
  const langs = new Set(available.value.map((d) => d.lang))
  const extra = Object.values(installed.value).filter((d) => !langs.has(d.lang))
  return [...available.value, ...extra.sort((a, b) => a.name.localeCompare(b.name))]
})

export function hasUpdate(lang: string): boolean {
  const current = installed.value[lang]
  const latest = available.value.find((d) => d.lang === lang)
  return !!current && !!latest && latest.build_date !== current.build_date
}

function loadInstalled(): Record<string, InstalledDictionary> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveInstalled(value: Record<string, InstalledDictionary>) {
  installed.value = value
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

async function activate(lang: string | null) {
  activeLang.value = lang
  loadRecents(lang)
  activeMeta.value = null
  if (lang) localStorage.setItem(ACTIVE_KEY, lang)
  else localStorage.removeItem(ACTIVE_KEY)
  const info = lang ? installed.value[lang] : null
  if (!info) return void (await db.close())
  activeMeta.value = await db.open(info.file)
}

export async function startup() {
  try {
    const files = new Set(
      await db.init(() => {
        waitingForOtherTab.value = true
      }),
    )
    waitingForOtherTab.value = false
    // Forget dictionaries whose files are gone (e.g. storage was cleared).
    const present = Object.fromEntries(Object.entries(installed.value).filter(([, d]) => files.has(d.file)))
    saveInstalled(present)
    const stored = localStorage.getItem(ACTIVE_KEY)
    const lang = stored && present[stored] ? stored : Object.keys(present).sort()[0] ?? null
    try {
      await activate(lang)
    } catch (error) {
      startupError.value = error instanceof Error ? error.message : String(error)
    }
  } catch (error) {
    startupError.value =
      'This browser can’t store dictionaries offline. ' + (error instanceof Error ? error.message : String(error))
  } finally {
    ready.value = true
  }
}

let manifestRequest: Promise<void> | null = null

/** Fetches the dictionary list; concurrent callers share one request. */
export function loadManifest(): Promise<void> {
  manifestRequest ??= fetchManifest().finally(() => {
    manifestRequest = null
  })
  return manifestRequest
}

async function fetchManifest() {
  manifestState.value = 'loading'
  try {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' })
    if (!response.ok) throw new Error(String(response.status))
    const manifest = await response.json()
    available.value = (manifest.dictionaries as DictionaryInfo[]).filter((d) => d.schema_version <= 1)
    manifestState.value = 'loaded'
  } catch {
    manifestState.value = { failed: 'Couldn’t load the dictionary list. Check your connection.' }
  }
}

function setInstallState(lang: string, state: InstallState | null) {
  const next = { ...installStates.value }
  if (state) next[lang] = state
  else delete next[lang]
  installStates.value = next
}

export async function install(info: DictionaryInfo) {
  const state = installStates.value[info.lang]
  if (state && state.kind !== 'failed') return
  setInstallState(info.lang, { kind: 'downloading', fraction: 0 })
  // Ask the browser not to evict our storage under pressure.
  navigator.storage?.persist?.().catch(() => {})

  const previous = installed.value[info.lang]
  const file = `/${info.lang}-${info.build_date.replace(/[^0-9]/g, '')}.sqlite`
  const base = new URL('data/', document.baseURI)
  try {
    await db.install(
      file,
      info.parts.map((p) => new URL(p.file, base).href),
      info.size,
      info.uncompressed_size,
      (loaded, total) => {
        const fraction = total ? loaded / total : 0
        setInstallState(info.lang, fraction >= 1 ? { kind: 'installing' } : { kind: 'downloading', fraction })
      },
    )
    saveInstalled({ ...installed.value, [info.lang]: { ...info, file } })
    if (!activeLang.value || activeLang.value === info.lang) await activate(info.lang)
    if (previous && previous.file !== file) await db.remove(previous.file).catch(() => {})
    setInstallState(info.lang, null)
  } catch (error) {
    setInstallState(info.lang, { kind: 'failed', message: describeError(error) })
  }
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/quota|space|full/i.test(message)) return 'Not enough storage space on this device.'
  if (/fetch|network|load failed|download/i.test(message)) return 'Download failed. Check your connection and try again.'
  return message
}

export async function remove(lang: string) {
  const info = installed.value[lang]
  if (!info) return
  const next = { ...installed.value }
  delete next[lang]
  saveInstalled(next)
  if (activeLang.value === lang) await activate(Object.keys(next).sort()[0] ?? null)
  await db.remove(info.file).catch(() => {})
}

export async function setActive(lang: string) {
  if (installed.value[lang] && activeLang.value !== lang) await activate(lang)
}
