import { useEffect, useState } from 'preact/hooks'
import { failedUrl, play, playingUrl, stop } from '../lib/audio'
import { db } from '../lib/db'
import {
  accentLabel,
  displayIPA,
  outline,
  posName,
  senseGloss,
  senseTargets,
  type Entry,
  type OutlineItem,
} from '../lib/model'
import { addRecent } from '../lib/recents'
import { back, pushWord } from '../lib/nav'
import { BackIcon, LinkArrowIcon, PlayIcon, SpeakerIcon, TurnRightIcon, WarningIcon } from './icons'

export function WordScreen({ word }: { word: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    db.entries(word)
      .then((result) => {
        if (cancelled) return
        setEntries(result)
        if (result.length) {
          addRecent({
            word,
            partsOfSpeech: [...new Set(result.map((e) => e.pos))],
            gloss: result[0].data.senses[0] ? senseGloss(result[0].data.senses[0]) : null,
          })
        }
      })
      .catch(() => !cancelled && setEntries([]))
    return () => {
      cancelled = true
    }
  }, [word])

  const wiktionary = `https://en.wiktionary.org/wiki/${encodeURIComponent(word.replaceAll(' ', '_'))}#English`

  return (
    <div class="screen word-screen">
      <header class="topbar">
        <div class="topbar-side">
          <button class="circle-button" aria-label="Back" onClick={() => back()}>
            <BackIcon />
          </button>
        </div>
      </header>
      <div class="scroll">
        <article class="word-page">
          <h2 class="headword">{word}</h2>
          {entries && <Pronunciation entries={entries} />}
          {entries?.map((entry) => <EntrySection key={entry.id} entry={entry} />)}
          {entries && entries.length === 0 && <p class="muted">No entry found.</p>}
          <a class="wiktionary-link" href={wiktionary} target="_blank" rel="noopener">
            <LinkArrowIcon /> View on Wiktionary
          </a>
        </article>
      </div>
    </div>
  )
}

function Pronunciation({ entries }: { entries: Entry[] }) {
  const seenIpa = new Set<string>()
  const ipa: { ipa: string; label: string | null }[] = []
  const seenUrls = new Set<string>()
  const seenLabels = new Set<string>()
  const clips: { url: string; label: string }[] = []

  for (const entry of entries) {
    for (const item of displayIPA(entry.data)) {
      if (seenIpa.has(item.ipa)) continue
      seenIpa.add(item.ipa)
      ipa.push({ ipa: item.ipa, label: accentLabel(item.tags) })
    }
    for (const clip of entry.data.audio ?? []) {
      if (seenUrls.has(clip.url)) continue
      seenUrls.add(clip.url)
      const label = accentLabel(clip.tags) ?? 'Listen'
      if (seenLabels.has(label)) continue
      seenLabels.add(label)
      clips.push({ url: clip.url, label })
    }
  }
  if (!ipa.length && !clips.length) return null

  return (
    <div class="pronunciation">
      {ipa.slice(0, 4).map((item) => (
        <div class="ipa-row" key={item.ipa}>
          {item.label && <span class="ipa-label">{item.label}</span>}
          <span class="ipa">{item.ipa}</span>
        </div>
      ))}
      {clips.length > 0 && (
        <div class="audio-buttons">
          {clips.slice(0, 3).map((clip) => (
            <AudioButton key={clip.url} {...clip} />
          ))}
        </div>
      )}
    </div>
  )
}

function AudioButton({ url, label }: { url: string; label: string }) {
  const playing = playingUrl.value === url
  const failed = failedUrl.value === url
  return (
    <button class={`audio-button${playing ? ' playing' : ''}`} onClick={() => (playing ? stop() : play(url))}>
      {failed ? <WarningIcon /> : playing ? <SpeakerIcon /> : <PlayIcon />}
      <span>{label}</span>
    </button>
  )
}

function EntrySection({ entry }: { entry: Entry }) {
  return (
    <section class="entry">
      <div class="pos">{posName(entry.pos)}</div>
      {outline(entry.data).map((item) => (
        <SenseRow key={item.number} item={item} />
      ))}
    </section>
  )
}

function SenseRow({ item }: { item: OutlineItem }) {
  const sense = item.sense
  const targets = sense ? senseTargets(sense) : []
  return (
    <div class={`sense${item.isSubsense ? ' sub' : ''}`}>
      <span class="sense-number">{item.number}</span>
      <div class="sense-body">
        {item.labels.length > 0 && <div class="labels">{item.labels.join(', ')}</div>}
        <div class={`gloss${sense ? '' : ' parent'}`}>{item.gloss}</div>
        {targets.length > 0 && (
          <div class="targets">
            {targets.map((target) => (
              <button key={target} class="target-link" onClick={() => pushWord(target)}>
                <TurnRightIcon /> {target}
              </button>
            ))}
          </div>
        )}
        {sense?.examples?.map((example, i) => (
          <blockquote key={i} class="example">
            <div>{example.text}</div>
            {example.translation && <div class="translation">{example.translation}</div>}
          </blockquote>
        ))}
      </div>
    </div>
  )
}
