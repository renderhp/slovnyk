// iOS-style navigation: pages slide in from the right over a dimmed, parallaxed page
// below, and can be swiped back from anywhere on the page (like iOS 26).
import type { ComponentChildren } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { back, lastPopMode, stack } from '../lib/nav'
import { WordScreen } from './WordScreen'

type Phase = 'enter' | 'idle' | 'exit'
interface Layer {
  key: number
  word: string
  phase: Phase
}

const DURATION = 380 // ms, matches --nav-duration in CSS
const SLOP = 10 // px of movement before deciding between a back swipe and scrolling
const PARALLAX = 0.3 // the page below sits at -30% while covered

let nextKey = 1

export function NavStack({ base, inert = false }: { base: ComponentChildren; inert?: boolean }) {
  const [layers, setLayers] = useState<Layer[]>([])
  const container = useRef<HTMLDivElement>(null)

  // Keep rendered layers in sync with the history stack, leaving room for animations.
  useLayoutEffect(() => {
    const words = stack.value
    setLayers((current) => {
      const live = current.filter((l) => l.phase !== 'exit')
      if (words.length > live.length) {
        const added = words.slice(live.length).map((word) => ({ key: nextKey++, word, phase: 'enter' as Phase }))
        return [...current, ...added]
      }
      if (words.length < live.length) {
        const removed = new Set(live.slice(words.length).map((l) => l.key))
        if (lastPopMode === 'instant') return current.filter((l) => !removed.has(l.key))
        return current.map((l) => (removed.has(l.key) ? { ...l, phase: 'exit' as Phase } : l))
      }
      return current
    })
  }, [stack.value])

  // enter -> idle on the next frame so the transition runs; drop exited layers afterwards.
  useEffect(() => {
    if (layers.some((l) => l.phase === 'enter')) {
      const frame = requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setLayers((current) => current.map((l) => (l.phase === 'enter' ? { ...l, phase: 'idle' } : l))),
        ),
      )
      return () => cancelAnimationFrame(frame)
    }
    if (layers.some((l) => l.phase === 'exit')) {
      const timer = setTimeout(() => setLayers((current) => current.filter((l) => l.phase !== 'exit')), DURATION)
      return () => clearTimeout(timer)
    }
  }, [layers])

  useSwipeBack(container)

  const isCovered = (index: number) => layers.slice(index + 1).some((l) => l.phase === 'idle')
  const topIndex = layers.findLastIndex((l) => l.phase !== 'exit')

  return (
    <div class="nav-stack" ref={container}>
      <div class={`nav-layer${isCovered(-1) ? ' covered' : ''}`} data-depth={0} inert={inert || isCovered(-1)}>
        {base}
        <div class="nav-dim" />
      </div>
      {layers.map((layer, i) => (
        <div
          key={layer.key}
          class={`nav-layer page ${layer.phase}${isCovered(i) ? ' covered' : ''}${i === topIndex ? ' top' : ''}`}
          data-depth={i + 1}
          // inert (not aria-hidden): also unfocusable, and drops focus from a page being popped.
          inert={inert || i !== topIndex}
        >
          <WordScreen word={layer.word} />
          <div class="nav-dim" />
        </div>
      ))}
    </div>
  )
}

/**
 * Interactive back swipe on the top page, starting anywhere. It only takes over once the
 * finger moves clearly rightward; vertical movement is left to scrolling.
 * Moves elements directly for 60fps tracking.
 */
function useSwipeBack(container: { current: HTMLDivElement | null }) {
  useEffect(() => {
    const root = container.current
    if (!root) return

    let top: HTMLElement | null = null
    let below: HTMLElement | null = null
    let startX = 0
    let startY = 0
    let dragging = false
    let samples: { x: number; t: number }[] = []

    const set = (el: HTMLElement | null, x: number, dim: number, transition: boolean) => {
      if (!el) return
      el.style.transition = transition ? '' : 'none'
      el.style.transform = `translate3d(${x}px, 0, 0)`
      const shade = el.querySelector<HTMLElement>(':scope > .nav-dim')
      if (shade) {
        shade.style.transition = transition ? '' : 'none'
        shade.style.opacity = String(dim)
      }
    }
    const clear = (el: HTMLElement | null) => {
      if (!el) return
      el.style.transition = el.style.transform = ''
      const shade = el.querySelector<HTMLElement>(':scope > .nav-dim')
      if (shade) shade.style.transition = shade.style.opacity = ''
    }
    const position = (dx: number, transition: boolean) => {
      const width = root.clientWidth
      const progress = Math.min(Math.max(dx / width, 0), 1)
      set(top, dx, 0, transition)
      set(below, -width * PARALLAX * (1 - progress), 1 - progress, transition)
    }

    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      const candidate = root.querySelector<HTMLElement>(':scope > .nav-layer.page.top.idle')
      if (e.touches.length !== 1 || !candidate) return
      top = candidate
      below = top.previousElementSibling as HTMLElement | null
      startX = touch.clientX
      startY = touch.clientY
      dragging = false
      samples = [{ x: touch.clientX, t: e.timeStamp }]
    }

    const onMove = (e: TouchEvent) => {
      if (!top) return
      const touch = e.touches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (!dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
        // Vertical or leftward: not ours. Let the page scroll.
        if (dx <= 0 || Math.abs(dy) * 1.2 > dx) return void (top = below = null)
        dragging = true
        startX = touch.clientX // start tracking from here so the page doesn't jump
        root.classList.add('swiping')
      }
      e.preventDefault()
      samples.push({ x: touch.clientX, t: e.timeStamp })
      if (samples.length > 5) samples.shift()
      position(Math.max(dx, 0), false)
    }

    const onEnd = (e: TouchEvent) => {
      if (!top) return
      const page = top
      const under = below
      top = below = null
      if (!dragging) return
      root.classList.remove('swiping')
      const touch = e.changedTouches[0]
      const dx = Math.max(touch.clientX - startX, 0)
      const first = samples[0]
      const velocity = first ? (touch.clientX - first.x) / Math.max(e.timeStamp - first.t, 1) : 0 // px/ms
      const width = root.clientWidth
      const complete = dx > width * 0.35 || (velocity > 0.35 && dx > 20)

      top = page
      below = under
      position(complete ? width : 0, true)
      top = below = null
      setTimeout(() => {
        if (complete) {
          clear(under)
          back(false) // page is already off screen; remove it without another animation
          requestAnimationFrame(() => clear(page))
        } else {
          clear(page)
          clear(under)
        }
      }, DURATION)
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd)
    root.addEventListener('touchcancel', onEnd)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onEnd)
    }
  }, [])
}
