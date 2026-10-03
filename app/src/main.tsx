import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDive } from './data.ts'

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
