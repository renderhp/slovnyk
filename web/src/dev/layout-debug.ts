// Dev-only overlay for debugging iOS home-screen layout.
export function showLayoutDebug() {
  const style = document.createElement('style')
  style.textContent = `.app { outline: 3px solid red; outline-offset: -3px; }
    #layout-debug { position: fixed; left: 8px; right: 8px; top: 45%; z-index: 9999; padding: 8px 10px;
      border-radius: 10px; background: rgba(40, 0, 0, 0.85); color: #fff; font: 13px/1.4 ui-monospace, monospace;
      pointer-events: none; white-space: pre; }`
  document.head.appendChild(style)
  const box = document.createElement('div')
  box.id = 'layout-debug'
  document.body.appendChild(box)

  const update = () => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const safe = `${parseFloat(cs.paddingTop)} / ${parseFloat(cs.paddingBottom)}`
    probe.remove()
    const app = document.querySelector('.app')?.getBoundingClientRect()
    box.textContent = [
      `window   ${innerWidth} x ${innerHeight}`,
      `screen   ${screen.width} x ${screen.height}`,
      `visual   ${visualViewport?.width} x ${Math.round(visualViewport?.height ?? 0)} @${visualViewport?.offsetTop}`,
      `html     ${document.documentElement.clientHeight}   body ${document.body.clientHeight}`,
      `app      ${Math.round(app?.top ?? 0)} .. ${Math.round(app?.bottom ?? 0)}`,
      `safe t/b ${safe}`,
      `vh probe ${probeUnit('100vh')} svh ${probeUnit('100svh')} lvh ${probeUnit('100lvh')} dvh ${probeUnit('100dvh')}`,
    ].join('\n')
  }
  const probeUnit = (h: string) => {
    const el = document.createElement('div')
    el.style.cssText = `position:fixed;visibility:hidden;height:${h}`
    document.body.appendChild(el)
    const value = el.getBoundingClientRect().height
    el.remove()
    return Math.round(value)
  }
  update()
  addEventListener('resize', update)
  setInterval(update, 1000)
}
