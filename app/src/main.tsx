import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDive } from './data.ts'

const root = createRoot(document.getElementById('root')!)
// Diagrams measure text on a canvas, so the fonts must be loaded first.
const fonts = ['Next', 'Mono'].map((f) =>
  document.fonts.load(`1em "Atkinson Hyperlegible ${f} Variable"`).catch(() => {}),
)
Promise.all([loadDive(), ...fonts])
  .then(([dive]) =>
    root.render(
      <StrictMode>
        <App dive={dive} />
      </StrictMode>,
    ),
  )
  .catch((e: Error) =>
    root.render(<p className="p-8 text-muted">This dive has no data. Rebuild it with dive.py build. ({e.message})</p>),
  )
