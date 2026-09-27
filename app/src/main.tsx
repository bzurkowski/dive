import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDive } from './data.ts'

const root = createRoot(document.getElementById('root')!)
loadDive()
  .then((dive) =>
    root.render(
      <StrictMode>
        <App dive={dive} />
      </StrictMode>,
    ),
  )
  .catch((e: Error) =>
    root.render(<p className="p-8 text-muted">This dive has no data. Rebuild it with dive.py build. ({e.message})</p>),
  )
