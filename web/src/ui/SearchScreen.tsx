import { useEffect, useRef, useState } from 'preact/hooks'
import { db } from '../lib/db'
import { activeInfo } from '../lib/library'
import { posName, type SearchResult } from '../lib/model'
import { pushWord } from '../lib/nav'
import { clearRecents, recents, removeRecent, type Recent } from '../lib/recents'
import { closeSwipeRows, SwipeRow } from './SwipeRow'
import { BookIcon, BooksIcon, ChevronIcon, ClearIcon, SearchIcon } from './icons'
import { compactNumber } from './format'

export function SearchScreen({ onOpenLibrary, initialQuery }: { onOpenLibrary: () => void; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState('')
  const sequence = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const info = activeInfo.value

  useEffect(() => {
    const current = query
    const id = ++sequence.current
    if (!current.trim()) {
      setResults([])
      setSearched('')
      return
    }
    const timer = setTimeout(async () => {
      const found = await db.search(current).catch(() => [])
      if (id !== sequence.current) return // a newer search started
      setResults(found)
      setSearched(current)
    }, 80)
    return () => clearTimeout(timer)
  }, [query])

  const empty = !query.trim()

  return (
    <div class="screen">
      <header class="topbar">
        <div class="topbar-side" />
        <h1 class="topbar-title">Slovnyk</h1>
        <div class="topbar-side right">
          <button class="circle-button" aria-label="Dictionaries" onClick={onOpenLibrary}>
            <BooksIcon />
          </button>
        </div>
      </header>

      <form
        class="search-field"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (results[0]) {
            input.current?.blur()
            pushWord(results[0].word)
          }
        }}
      >
        <SearchIcon class="search-icon" />
        <input
          ref={input}
          type="search"
          placeholder={`Search ${info?.name ?? ''}`}
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          enterkeyhint="search"
          {...{ autocorrect: 'off' }}
        />
        {query && (
          <button
            type="button"
            class="clear-button"
            aria-label="Clear"
            onClick={() => {
              setQuery('')
              input.current?.focus()
            }}
          >
            <ClearIcon />
          </button>
        )}
      </form>

      <div class="scroll" onTouchStart={() => input.current?.blur()} onScroll={closeSwipeRows}>
        {empty && recents.value.length > 0 ? (
          <RecentList />
        ) : empty ? (
          <div class="empty-state">
            <BookIcon class="accent" />
            <div class="empty-title">Look up a word</div>
            {info && (
              <div class="empty-subtitle">
                {info.name} · {compactNumber(info.entry_count)} entries · offline
              </div>
            )}
          </div>
        ) : results.length === 0 && searched === query ? (
          <div class="empty-state">
            <SearchIcon size={44} class="muted" />
            <div class="empty-title">No Results for “{query}”</div>
            <div class="empty-subtitle">Check the spelling or try a new search.</div>
          </div>
        ) : (
          <ul class="results">
            {results.map((result) => (
              <li key={result.word}>
                <button class="result-row" onClick={() => pushWord(result.word)}>
                  <ResultContent {...result} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ResultContent({ word, partsOfSpeech, gloss, matchedForm }: Recent & { matchedForm?: string | null }) {
  return (
    <>
      <div class="result-text">
        <div class="result-line">
          <span class="result-word">{word}</span>
          <span class="result-pos">{partsOfSpeech.map(posName).join(' · ')}</span>
        </div>
        {matchedForm && <div class="result-form">form: {matchedForm}</div>}
        {gloss && <div class="result-gloss">{gloss}</div>}
      </div>
      <ChevronIcon class="chevron" />
    </>
  )
}

function RecentList() {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 3000)
    return () => clearTimeout(timer)
  }, [confirming])

  return (
    <div class="recents">
      <div class="list-header">
        <span>Recent</span>
        <button
          class={`text-button${confirming ? ' danger' : ''}`}
          onClick={() => {
            if (!confirming) return setConfirming(true)
            setConfirming(false)
            clearRecents()
          }}
        >
          {confirming ? 'Clear All' : 'Clear'}
        </button>
      </div>
      <ul class="results">
        {recents.value.map((recent) => (
          <SwipeRow key={recent.word} onTap={() => pushWord(recent.word)} onDelete={() => removeRecent(recent.word)}>
            <div class="result-row">
              <ResultContent {...recent} />
            </div>
          </SwipeRow>
        ))}
      </ul>
    </div>
  )
}
