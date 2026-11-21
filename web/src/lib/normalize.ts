import { COMBINING_RANGES } from './combining'

function isCombining(cp: number): boolean {
  // Binary search over [start, end] pairs.
  let lo = 0
  let hi = COMBINING_RANGES.length / 2 - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (cp < COMBINING_RANGES[mid * 2]) hi = mid - 1
    else if (cp > COMBINING_RANGES[mid * 2 + 1]) lo = mid + 1
    else return true
  }
  return false
}

/** Separate letters that look like letter + mark (Ukrainian й ї, Russian ё, Belarusian ў). */
const KEEP_LETTERS = new Set('йЙїЇёЁўЎ')

/**
 * Search key. Must match `normalize()` in pipeline/build.py: NFC; drop combining marks
 * (stress, accents) from every character except KEEP_LETTERS, using NFKD; lowercase;
 * unify apostrophes; collapse whitespace.
 */
export function normalize(input: string): string {
  let stripped = ''
  for (const ch of input.normalize('NFC')) {
    if (KEEP_LETTERS.has(ch)) {
      stripped += ch
      continue
    }
    for (const part of ch.normalize('NFKD')) {
      if (!isCombining(part.codePointAt(0)!)) stripped += part
    }
  }
  return stripped
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ')
}
