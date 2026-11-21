// Dictionary data types and presentation helpers (mirrors ios/Slovnyk/Model/Entry.swift).

export interface Example {
  text: string
  translation?: string
}

export interface Sense {
  glosses: string[]
  tags?: string[]
  topics?: string[]
  qualifier?: string
  form_of?: string[]
  alt_of?: string[]
  examples?: Example[]
}

export interface Pronunciation {
  ipa: string
  tags?: string[]
}

export interface Audio {
  url: string
  file?: string
  tags?: string[]
}

export interface EntryData {
  senses: Sense[]
  ipa?: Pronunciation[]
  audio?: Audio[]
}

export interface Entry {
  id: number
  word: string
  pos: string
  data: EntryData
}

export interface SearchResult {
  word: string
  partsOfSpeech: string[]
  gloss: string | null
  /** Set when the word was found through one of its forms (query "went" -> "go"). */
  matchedForm: string | null
}

const HIDDEN_TAGS = new Set(['form-of', 'alt-of', 'no-gloss', 'morpheme'])

const GRAMMATICAL_TAGS = new Set([
  'past', 'present', 'participle', 'simple', 'plural', 'singular', 'third-person',
  'first-person', 'second-person', 'comparative', 'superlative', 'indicative',
  'infinitive', 'gerund', 'possessive', 'subjunctive', 'imperative', 'tense',
])

export const senseGloss = (sense: Sense) => sense.glosses[sense.glosses.length - 1] ?? ''
export const parentGloss = (sense: Sense) => (sense.glosses.length > 1 ? sense.glosses[0] : null)
export const senseTargets = (sense: Sense) => [...(sense.form_of ?? []), ...(sense.alt_of ?? [])]

/** Human-readable labels like "obsolete, informal, sports". */
export function senseLabels(sense: Sense): string[] {
  const result: string[] = []
  if (sense.qualifier) result.push(sense.qualifier)
  const isFormOf = (sense.form_of ?? []).length > 0
  for (const tag of sense.tags ?? []) {
    if (HIDDEN_TAGS.has(tag)) continue
    // "past of go" already says it's the past tense.
    if (isFormOf && GRAMMATICAL_TAGS.has(tag)) continue
    result.push(tag.replaceAll('-', ' '))
  }
  result.push(...(sense.topics ?? []))
  return [...new Set(result)]
}

/** A numbered line in an entry: a top-level sense ("1") or a sub-sense ("1a"). */
export interface OutlineItem {
  number: string
  isSubsense: boolean
  gloss: string
  labels: string[]
  /** null for a parent heading that has no sense of its own. */
  sense: Sense | null
}

const letter = (i: number) => (i < 26 ? String.fromCharCode(97 + i) : String(i + 1))

/**
 * Turns Wiktionary's flat sense list (where sub-senses repeat their parent
 * gloss) into a numbered outline without duplicated parents.
 */
export function outline(data: EntryData): OutlineItem[] {
  const items: OutlineItem[] = []
  let number = 0
  let head: string | null = null
  let headLabels = new Set<string>()
  let subIndex = 0

  for (const sense of data.senses) {
    const parent = parentGloss(sense)
    if (parent !== null) {
      if (parent !== head) {
        number += 1
        subIndex = 0
        head = parent
        headLabels = new Set()
        items.push({ number: `${number}`, isSubsense: false, gloss: parent, labels: [], sense: null })
      }
      items.push({
        number: `${number}${letter(subIndex++)}`,
        isSubsense: true,
        gloss: senseGloss(sense),
        labels: senseLabels(sense).filter((l) => !headLabels.has(l)),
        sense,
      })
    } else {
      number += 1
      subIndex = 0
      head = senseGloss(sense)
      const labels = senseLabels(sense)
      headLabels = new Set(labels)
      items.push({ number: `${number}`, isSubsense: false, gloss: head, labels, sense })
    }
  }
  return items
}

/** Broad /phonemic/ transcriptions when available, otherwise everything. */
export function displayIPA(data: EntryData): Pronunciation[] {
  const all = data.ipa ?? []
  const broad = all.filter((p) => p.ipa.startsWith('/'))
  return broad.length ? broad : all
}

/** Short accent label for pronunciation tags ("Received-Pronunciation" -> "UK"). */
export function accentLabel(tags?: string[]): string | null {
  if (!tags?.length) return null
  const mapped = tags.map((tag) => {
    switch (tag) {
      case 'Received-Pronunciation':
      case 'UK':
      case 'British':
        return 'UK'
      case 'General-American':
      case 'US':
        return 'US'
      default:
        return tag.replaceAll('-', ' ')
    }
  })
  return [...new Set(mapped)].join(', ')
}

const POS_NAMES: Record<string, string> = {
  adj: 'adjective',
  adv: 'adverb',
  name: 'proper noun',
  prep: 'preposition',
  conj: 'conjunction',
  pron: 'pronoun',
  intj: 'interjection',
  num: 'numeral',
  det: 'determiner',
  abbrev: 'abbreviation',
  prep_phrase: 'prepositional phrase',
}

export const posName = (pos: string) => POS_NAMES[pos] ?? pos.replaceAll('_', ' ')
