import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App, params } from './App'
import { startup } from './lib/library'
import { startNavigation } from './lib/nav'
import { allowBrowserUse, browserUseAllowed, isStandalone } from './lib/platform'
import { InstallPage } from './ui/InstallPage'
import './styles.css'

registerSW({ immediate: true })
// Lets :active styles show on iOS while a finger is down.
document.addEventListener('touchstart', () => {}, { passive: true })

if (params.has('inBrowser')) allowBrowserUse() // for testing in a regular tab

const root = document.getElementById('app')!

if (isStandalone() || browserUseAllowed()) {
  startNavigation(params.get('word'))
  startup()
  render(<App />, root)
} else {
  // In a browser tab: explain how to install first. On iOS the installed app has its own
  // storage, so downloading a dictionary here would be wasted.
  render(<InstallPage onContinue={() => location.reload()} />, root)
}
