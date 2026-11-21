// Dictionary queries (mirrors ios/Slovnyk/Data/DictionaryDatabase.swift).
// Takes a plain query function so it runs against sqlite-wasm in the worker and in tests.
import type { Entry, EntryData, SearchResult } from './model'
import { normalize } from './normalize'

export type Row = (string | number | null)[]
export type QueryFn = (sql: string, params?: string[]) => Row[]

export const SUPPORTED_SCHEMA_VERSION = 1

export function readMeta(query: QueryFn): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const [key, value] of query('SELECT key, value FROM meta')) meta[String(key)] = String(value)
  return meta
}

const LOOKUP_COLUMNS = `
  SELECT l.norm, l.kind, e.word, e.pos, json_extract(e.data, '$.senses[0].glosses[#-1]')
  FROM lookup l JOIN entries e ON e.id = l.entry_id`

interface LookupRow {
  norm: string
  kind: number
  word: string
  pos: string
  gloss: string | null
}

const toLookup = (r: Row): LookupRow => ({
  norm: String(r[0]),
  kind: Number(r[1]),
  word: String(r[2]),
  pos: String(r[3]),
  gloss: r[4] === null ? null : String(r[4]),
})

export function search(query: QueryFn, text: string, limit = 60): SearchResult[] {
  const key = normalize(text)
  if (!key) return []

  const exact = query(`${LOOKUP_COLUMNS} WHERE l.norm = ? ORDER BY e.id LIMIT 200`, [key]).map(toLookup)
  const prefix = query(
    `${LOOKUP_COLUMNS} WHERE l.norm > ? AND l.norm < ? ORDER BY l.norm, e.id LIMIT 400`,
    [key, key + '\u{10FFFF}'],
  ).map(toLookup)

  // Exact matches first: headwords before forms, the exact spelling before case variants.
  const typed = text.trim()
  const rank = (r: LookupRow) => r.kind * 2 + (r.word === typed ? 0 : 1)
  const rankedExact = exact
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.i - b.i)
    .map(({ row }) => row)

  const results: SearchResult[] = []
  const index = new Map<string, number>()
  for (const row of [...rankedExact, ...prefix]) {
    const i = index.get(row.word)
    if (i !== undefined) {
      const result = results[i]
      if (!result.partsOfSpeech.includes(row.pos)) result.partsOfSpeech.push(row.pos)
      if (row.kind === 0) result.matchedForm = null
      continue
    }
    if (results.length >= limit) continue
    index.set(row.word, results.length)
    results.push({
      word: row.word,
      partsOfSpeech: [row.pos],
      gloss: row.gloss,
      matchedForm: row.kind === 1 ? row.norm : null,
    })
  }
  return results
}

export function entries(query: QueryFn, word: string): Entry[] {
  return query(
    `SELECT e.id, e.word, e.pos, e.data
     FROM lookup l JOIN entries e ON e.id = l.entry_id
     WHERE l.norm = ? AND l.kind = 0 AND e.word = ?
     ORDER BY e.id`,
    [normalize(word), word],
  ).map((r) => ({
    id: Number(r[0]),
    word: String(r[1]),
    pos: String(r[2]),
    data: JSON.parse(String(r[3])) as EntryData,
  }))
}
