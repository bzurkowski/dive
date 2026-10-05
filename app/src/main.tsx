import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import type { Dive } from './types'

// In dev the data tag holds the placeholder, so the dive comes from public/dive.json.
async function loadDive(): Promise<Dive> {
  try {
    return JSON.parse(document.getElementById('dive-data')?.textContent ?? '')
  } catch {
    const res = await fetch('dive.json')
    if (!res.ok) throw new Error(`dive.json: ${res.status} ${res.statusText}`)
    return res.json()
  }
}

const root = createRoot(document.getElementById('root')!)
const fonts = ['Atkinson Hyperlegible Next Variable', 'Atkinson Hyperlegible Mono Variable']
loadDive()
  .then(async (dive) => {
    // Diagrams measure text on a canvas, so load every font subset that the text of the dive needs (latin-ext is separate).
    const text = JSON.stringify(dive.chapters)
    await Promise.all(fonts.map((f) => document.fonts.load(`1em "${f}"`, text).catch(() => {})))
    root.render(
      <StrictMode>
        <App dive={dive} />
      </StrictMode>,
    )
  })
  .catch((e: Error) =>
    root.render(<p className="p-8 text-muted">This dive has no data. Rebuild it with dive.py build. ({e.message})</p>),
  )
