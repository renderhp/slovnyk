import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { beforeAll, describe, expect, it } from 'vitest'
import { normalize } from '../src/lib/normalize'
import { displayIPA, outline, senseLabels, type EntryData } from '../src/lib/model'
import { entries, readMeta, search, type QueryFn } from '../src/lib/queries'

const fixtures = new URL('../../ios/SlovnykTests/Fixtures/', import.meta.url)
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(name, fixtures)))

describe('normalize', () => {
  it('handles basics', () => {
    expect(normalize('Café')).toBe('cafe')
    expect(normalize('  don’t   stop ')).toBe("don't stop")
    expect(normalize('NAÏVE')).toBe('naive')
  })

  it('keeps separate Cyrillic letters but drops stress marks', () => {
    expect(normalize('Мій')).toBe('мій')
    expect(normalize('Їжак')).toBe('їжак')
    expect(normalize('сло́во')).toBe('слово')
    expect(normalize('мі\u0306й')).toBe('мій')
    expect(normalize('niño')).toBe('nino')
  })

  it('matches the pipeline on real headwords', () => {
    const cases: [string, string][] = JSON.parse(fixture('normalize_cases.json').toString())
    expect(cases.length).toBeGreaterThan(1000)
    const mismatches = cases.filter(([input, expected]) => normalize(input) !== expected)
    expect(mismatches.slice(0, 10)).toEqual([])
  })
})

describe('queries', () => {
  let query: QueryFn

  beforeAll(async () => {
    const sqlite3 = await sqlite3InitModule()
    const bytes = new Uint8Array(fixture('fixture.sqlite'))
    const pointer = sqlite3.wasm.allocFromTypedArray(bytes)
    const db = new sqlite3.oo1.DB()
    const flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_READONLY
    const rc = sqlite3.capi.sqlite3_deserialize(db.pointer!, 'main', pointer, bytes.length, bytes.length, flags)
    db.checkRc(rc)
    query = (sql, params = []) =>
      db.exec({ sql, bind: params, rowMode: 'array', returnValue: 'resultRows' }) as ReturnType<QueryFn>
  })

  it('reads meta', () => {
    expect(readMeta(query).entry_count).toBe('3')
  })

  it('prefix search', () => {
    const results = search(query, 'fre')
    expect(results.map((r) => r.word)).toEqual(['free'])
    expect(results[0].partsOfSpeech).toEqual(['adj'])
    expect(results[0].gloss).toBe('Not imprisoned or enslaved.')
  })

  it('finds words through their forms', () => {
    const [first] = search(query, 'freer')
    expect(first.word).toBe('free')
    expect(first.matchedForm).toBe('freer')
  })

  it('ignores accents and case', () => {
    expect(search(query, 'CAFE').map((r) => r.word)).toEqual(['Café'])
  })

  it('returns nothing for an empty query', () => {
    expect(search(query, '   ')).toEqual([])
  })

  it('loads entries', () => {
    const went = entries(query, 'went')
    expect(went).toHaveLength(1)
    expect(went[0].data.senses[0].form_of).toEqual(['go'])
    expect(entries(query, 'nope')).toEqual([])
  })
})

describe('outline', () => {
  it('letters sub-senses and drops repeated parent labels', () => {
    const data: EntryData = {
      senses: [
        { glosses: ['Unconstrained.'], qualifier: 'social' },
        { glosses: ['Unconstrained.', 'Not imprisoned.'], qualifier: 'social' },
        { glosses: ['Unconstrained.', 'Generous.'], qualifier: 'social', tags: ['obsolete'] },
        { glosses: ['Costing nothing.'] },
      ],
    }
    const items = outline(data)
    expect(items.map((i) => i.number)).toEqual(['1', '1a', '1b', '2'])
    expect(items[1].labels).toEqual([])
    expect(items[2].labels).toEqual(['obsolete'])
  })

  it('adds a heading for a parent without its own sense', () => {
    const items = outline({ senses: [{ glosses: ['P.', 'One.'] }, { glosses: ['P.', 'Two.'] }] })
    expect(items.map((i) => i.number)).toEqual(['1', '1a', '1b'])
    expect(items[0].sense).toBeNull()
  })

  it('hides grammatical tags on form-of senses', () => {
    expect(senseLabels({ glosses: ['past of go'], tags: ['form-of', 'past', 'archaic'], form_of: ['go'] })).toEqual([
      'archaic',
    ])
  })

  it('prefers broad IPA', () => {
    expect(displayIPA({ senses: [], ipa: [{ ipa: '/fɹiː/' }, { ipa: '[fɹɪi̯]' }] }).map((p) => p.ipa)).toEqual([
      '/fɹiː/',
    ])
  })
})
