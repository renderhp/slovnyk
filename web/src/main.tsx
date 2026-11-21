import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App, params } from './App'
import { startup } from './lib/library'
import { startNavigation } from './lib/nav'
import './styles.css'

registerSW({ immediate: true })
// Lets :active styles show on iOS while a finger is down.
document.addEventListener('touchstart', () => {}, { passive: true })
startNavigation(params.get('word'))
startup()
render(<App />, document.getElementById('app')!)
