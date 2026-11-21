import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App, params } from './App'
import { startup } from './lib/library'
import { startNavigation } from './lib/nav'
import './styles.css'

registerSW({ immediate: true })
startNavigation(params.get('word'))
startup()
render(<App />, document.getElementById('app')!)
