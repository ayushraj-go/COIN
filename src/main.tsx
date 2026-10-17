import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initPalette } from './lib/theme'
import { BUILD_KEY, isNewerBuild } from './store/session'

initPalette()

// One copy of the data serves every tab of this browser. When a newer build opens in another tab, a tab still running an
// older build reloads, so no tab keeps writing data in an older shape.
declare const __BUILD__: string
const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '0'
try { const seen = localStorage.getItem(BUILD_KEY); if (!seen || Number(seen) < Number(BUILD)) localStorage.setItem(BUILD_KEY, BUILD) } catch { /* storage blocked */ }
const checkBuild = (theirs: string | null) => { if (isNewerBuild(theirs, BUILD)) window.location.reload() }
window.addEventListener('storage', (e) => { if (e.key === BUILD_KEY) checkBuild(e.newValue) })
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { try { checkBuild(localStorage.getItem(BUILD_KEY)) } catch { /* ignore */ } } })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
