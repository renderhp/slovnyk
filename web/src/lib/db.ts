// Main-thread client for the database worker.
import type { Entry, SearchResult } from './model'
import type { RequestBody, WorkerResponse } from '../worker/protocol'

type Pending = {
  resolve: (value: any) => void
  reject: (error: Error) => void
  onProgress?: (loaded: number, total: number) => void
  onWaiting?: () => void
}

const worker = new Worker(new URL('../worker/db.worker.ts', import.meta.url), { type: 'module' })
const pending = new Map<number, Pending>()
let nextId = 1

worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
  const message = event.data
  const entry = pending.get(message.id)
  if (!entry) return
  if (message.type === 'progress') return entry.onProgress?.(message.loaded, message.total)
  if (message.type === 'waiting') return entry.onWaiting?.()
  pending.delete(message.id)
  if (message.type === 'result') entry.resolve(message.result)
  else entry.reject(new Error(message.message))
}

function call<T>(body: RequestBody, handlers: Pick<Pending, 'onProgress' | 'onWaiting'> = {}): Promise<T> {
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject, ...handlers })
    worker.postMessage({ ...body, id })
  })
}

export const db = {
  /** Sets up storage; returns the dictionary files present in OPFS. */
  init: (onWaiting: () => void) => call<string[]>({ type: 'init' }, { onWaiting }),
  open: (file: string) => call<Record<string, string>>({ type: 'open', file }),
  close: () => call<void>({ type: 'close' }),
  search: (text: string) => call<SearchResult[]>({ type: 'search', text }),
  entries: (word: string) => call<Entry[]>({ type: 'entries', word }),
  install: (
    file: string,
    info: { lang: string; buildDate: string; uncompressedSize: number },
    parts: string[],
    total: number,
    onProgress: (loaded: number, total: number) => void,
  ) => call<void>({ type: 'install', file, ...info, parts, total }, { onProgress }),
  /** Returns a description of the problem, or null if the stored dictionary is intact. */
  verify: (file: string, info: { lang: string; buildDate: string; uncompressedSize: number }) =>
    call<string | null>({ type: 'verify', file, ...info }),
  remove: (file: string) => call<void>({ type: 'remove', file }),
}
