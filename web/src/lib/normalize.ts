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

/**
 * Search key. Must match `normalize()` in pipeline/build.py:
 * NFKD, drop combining marks, lowercase, unify apostrophes, collapse whitespace.
 */
export function normalize(input: string): string {
  let stripped = ''
  for (const ch of input.normalize('NFKD')) {
    if (!isCombining(ch.codePointAt(0)!)) stripped += ch
  }
  return stripped
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/\s+/u)
    .filter(Boolean)
    .join(' ')
}
