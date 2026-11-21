// A table-view row with iOS-style swipe-to-delete: swipe left to reveal Delete,
// or swipe all the way to delete straight away.
import type { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

const ACTION_WIDTH = 88
const SLOP = 8

/** Only one row may be open at a time. */
let closeOpenRow: (() => void) | null = null
export const closeSwipeRows = () => closeOpenRow?.()

export function SwipeRow({
  onTap,
  onDelete,
  children,
}: {
  onTap: () => void
  onDelete: () => void
  children: ComponentChildren
}) {
  const row = useRef<HTMLLIElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const offset = useRef(0) // current resting offset: 0 or -ACTION_WIDTH
  const deleting = useRef(false)

  const move = (x: number, animate: boolean) => {
    const el = content.current
    if (!el) return
    el.style.transition = animate ? '' : 'none'
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : ''
    row.current?.style.setProperty('--reveal', String(Math.max(-x, 0)))
  }

  const close = () => {
    offset.current = 0
    move(0, true)
    if (closeOpenRow === close) closeOpenRow = null
  }

  const remove = () => {
    if (deleting.current) return
    deleting.current = true
    if (closeOpenRow === close) closeOpenRow = null
    const li = row.current
    if (!li) return onDelete()
    move(-li.clientWidth, true)
    // Then collapse the row's height, then actually delete it.
    li.style.height = `${li.offsetHeight}px`
    setTimeout(() => {
      li.classList.add('collapsing')
      li.style.height = '0px'
      setTimeout(onDelete, 250)
    }, 200)
  }

  useEffect(() => {
    const li = row.current
    if (!li) return
    let startX = 0
    let startY = 0
    let tracking = false
    let dragging = false
    let lastX = 0
    let lastT = 0
    let velocity = 0

    const onStart = (e: TouchEvent) => {
      if (deleting.current || e.touches.length !== 1) return
      if (closeOpenRow && closeOpenRow !== close) closeOpenRow()
      tracking = true
      dragging = false
      startX = lastX = e.touches[0].clientX
      startY = e.touches[0].clientY
      lastT = e.timeStamp
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const x = e.touches[0].clientX
      const dx = x - startX
      const dy = e.touches[0].clientY - startY
      if (!dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
        if (Math.abs(dy) > Math.abs(dx)) return void (tracking = false) // scrolling
        dragging = true
        startX = x
        li.classList.add('swiping')
      }
      e.preventDefault()
      velocity = (x - lastX) / Math.max(e.timeStamp - lastT, 1)
      lastX = x
      lastT = e.timeStamp
      let next = offset.current + (x - startX)
      if (next > 0) next = next / 4 // resist swiping right past the start
      move(next, false)
    }
    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (!dragging) return
      li.classList.remove('swiping')
      const position = offset.current + (lastX - startX)
      if (-position > li.clientWidth * 0.55) return remove()
      if (-position > ACTION_WIDTH / 2 || velocity < -0.4) {
        offset.current = -ACTION_WIDTH
        move(-ACTION_WIDTH, true)
        closeOpenRow = close
      } else {
        close()
      }
    }

    li.addEventListener('touchstart', onStart, { passive: true })
    li.addEventListener('touchmove', onMove, { passive: false })
    li.addEventListener('touchend', onEnd)
    li.addEventListener('touchcancel', onEnd)
    return () => {
      li.removeEventListener('touchstart', onStart)
      li.removeEventListener('touchmove', onMove)
      li.removeEventListener('touchend', onEnd)
      li.removeEventListener('touchcancel', onEnd)
      if (closeOpenRow === close) closeOpenRow = null
    }
  }, [])

  return (
    <li class="swipe-row" ref={row}>
      <button class="swipe-action" tabIndex={-1} onClick={remove}>
        Delete
      </button>
      <div
        class="swipe-content"
        ref={content}
        onClick={() => {
          if (offset.current !== 0) return close()
          if (closeOpenRow) return closeSwipeRows()
          onTap()
        }}
      >
        {children}
        <button
          class="row-remove"
          aria-label="Remove from history"
          onClick={(e) => {
            e.stopPropagation()
            remove()
          }}
        >
          ×
        </button>
      </div>
    </li>
  )
}
