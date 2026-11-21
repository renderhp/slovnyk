// Streams pronunciation audio from Wikimedia Commons.
import { signal } from '@preact/signals'

export const playingUrl = signal<string | null>(null)
export const failedUrl = signal<string | null>(null)

let player: HTMLAudioElement | null = null

export function play(url: string) {
  stop()
  const audio = new Audio(url)
  player = audio
  playingUrl.value = url
  failedUrl.value = null
  const done = (failed: boolean) => {
    if (player !== audio) return
    playingUrl.value = null
    if (failed) failedUrl.value = url
  }
  audio.addEventListener('ended', () => done(false))
  audio.addEventListener('error', () => done(true))
  audio.play().catch(() => done(true))
}

export function stop() {
  player?.pause()
  player = null
  playingUrl.value = null
}
