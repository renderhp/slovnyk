/// <reference lib="webworker" />
// Owns SQLite (WebAssembly) and the dictionary files stored in OPFS.
import sqlite3InitModule, { type Database, type SAHPoolUtil, type Sqlite3Static } from '@sqlite.org/sqlite-wasm'
import { entries, readMeta, search, SUPPORTED_SCHEMA_VERSION, type QueryFn } from '../lib/queries'
import type { WorkerRequest, WorkerResponse } from './protocol'

let sqlite3: Sqlite3Static
let pool: SAHPoolUtil | null = null
let db: Database | null = null
let dbFile: string | null = null
let query: QueryFn | null = null

const post = (message: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(message)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const LOCK_NAME = 'slovnyk-storage'
let lockAcquired: Promise<void> | null = null

/**
 * Only one page at a time may hold the storage files open, so every worker takes an
 * exclusive lock first and keeps it until it dies (tab closed or reloaded). Calls
 * `onWaiting` if another tab currently has it.
 */
function acquireLock(onWaiting: () => void): Promise<void> {
  lockAcquired ??= new Promise<void>((resolve) => {
    let granted = false
    navigator.locks.request(LOCK_NAME, () => {
      granted = true
      resolve()
      return new Promise<never>(() => {}) // hold for the worker's lifetime
    })
    setTimeout(() => granted || onWaiting(), 300)
  })
  return lockAcquired
}

async function init(id: number): Promise<string[]> {
  sqlite3 ??= await sqlite3InitModule()
  await acquireLock(() => post({ id, type: 'waiting' }))
  // A page that just reloaded can release its file handles a moment after its lock.
  for (let attempt = 0; !pool; attempt++) {
    try {
      pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'slovnyk', initialCapacity: 4 })
    } catch (error) {
      if (attempt >= 10) throw error
      await sleep(300)
    }
  }
  await pool.reserveMinimumCapacity(4)
  return pool.getFileNames()
}

function requirePool(): SAHPoolUtil {
  if (!pool) throw new Error('Offline storage is not available.')
  return pool
}

function openReadOnly(file: string): Database {
  return new sqlite3.oo1.DB({ filename: file, flags: 'r', vfs: requirePool().vfsName })
}

function queryFor(database: Database): QueryFn {
  return (sql, params = []) =>
    database.exec({ sql, bind: params, rowMode: 'array', returnValue: 'resultRows' }) as ReturnType<QueryFn>
}

function checkSchema(meta: Record<string, string>) {
  const version = Number(meta.schema_version)
  if (!version || version > SUPPORTED_SCHEMA_VERSION) throw new Error('Unsupported dictionary format')
}

function open(file: string): Record<string, string> {
  close()
  const database = openReadOnly(file)
  try {
    const q = queryFor(database)
    const meta = readMeta(q)
    checkSchema(meta)
    db = database
    dbFile = file
    query = q
    return meta
  } catch (error) {
    database.close()
    throw error
  }
}

function close() {
  db?.close()
  db = null
  dbFile = null
  query = null
}

/** Streams gzip parts -> gunzip -> OPFS, then checks the result opens. */
async function install(id: number, file: string, parts: string[], total: number, expectedSize: number) {
  let loaded = 0
  let lastReport = 0
  const report = () => {
    const now = performance.now()
    if (now - lastReport > 100 || loaded === total) {
      lastReport = now
      post({ id, type: 'progress', loaded, total })
    }
  }

  // One stream that reads the parts back to back.
  let partIndex = 0
  let partReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  const compressed = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (!partReader) {
          if (partIndex >= parts.length) return controller.close()
          const response = await fetch(parts[partIndex++], { cache: 'no-store' })
          if (!response.ok || !response.body) throw new Error(`Download failed (${response.status})`)
          partReader = response.body.getReader()
        }
        const { done, value } = await partReader.read()
        if (done) {
          partReader = null
          continue
        }
        loaded += value.byteLength
        report()
        controller.enqueue(value)
        return
      }
    },
  })

  const gunzip = new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>
  const reader = compressed.pipeThrough(gunzip).getReader()
  if (dbFile === file) close()
  const written = await requirePool().importDb(file, async () => {
    const { done, value } = await reader.read()
    return done ? undefined : value
  })
  if (written !== expectedSize) {
    requirePool().unlink(file)
    throw new Error('The downloaded dictionary is incomplete. Please try again.')
  }

  const check = openReadOnly(file)
  try {
    checkSchema(readMeta(queryFor(check)))
  } catch (error) {
    check.close()
    requirePool().unlink(file)
    throw error
  }
  check.close()
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  try {
    let result: unknown
    switch (request.type) {
      case 'init':
        result = await init(request.id)
        break
      case 'open':
        result = open(request.file)
        break
      case 'close':
        close()
        break
      case 'search':
        result = query ? search(query, request.text) : []
        break
      case 'entries':
        result = query ? entries(query, request.word) : []
        break
      case 'install':
        await install(request.id, request.file, request.parts, request.total, request.uncompressedSize)
        break
      case 'remove':
        if (dbFile === request.file) close()
        requirePool().unlink(request.file)
        break
    }
    post({ id: request.id, type: 'result', result })
  } catch (error) {
    post({ id: request.id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
