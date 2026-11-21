// Where we're running, for install instructions.

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as { standalone?: boolean }).standalone === true

const ua = navigator.userAgent

/** iPhone, iPod, or iPad (which reports itself as a Mac with touch). */
export const isIOS = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
export const isAndroid = /Android/.test(ua)
/** Safari on macOS (Add to Dock), not Chrome/Edge/Firefox. */
export const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)

const BYPASS_KEY = 'slovnyk.useInBrowser'
export const browserUseAllowed = () => localStorage.getItem(BYPASS_KEY) === '1'
export const allowBrowserUse = () => localStorage.setItem(BYPASS_KEY, '1')

/** The deferred `beforeinstallprompt` event (Chrome, Edge, Android). */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredPrompt = event as InstallPromptEvent
  listeners.forEach((fn) => fn())
})

export const canPromptInstall = () => deferredPrompt !== null
export const onInstallPromptChange = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false
  const event = deferredPrompt
  deferredPrompt = null
  listeners.forEach((fn) => fn())
  await event.prompt()
  return (await event.userChoice).outcome === 'accepted'
}

/**
 * iOS home-screen apps with a translucent status bar lay the page out under the status
 * bar but size it as if the bar took space, so full-height layouts end ~60pt above the
 * bottom of the screen. There the app always fills the screen, so size it from the screen.
 */
export function fitToScreen() {
  if (!isIOS || !isStandalone()) return
  const update = () => {
    const portrait = matchMedia('(orientation: portrait)').matches
    const long = Math.max(screen.width, screen.height)
    const short = Math.min(screen.width, screen.height)
    const height = Math.max(window.innerHeight, portrait ? long : short)
    document.documentElement.style.setProperty('--app-height', `${height}px`)
  }
  update()
  addEventListener('resize', update)
  addEventListener('orientationchange', () => setTimeout(update, 300))
}
