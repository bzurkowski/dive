import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadDive } from './data.ts'

loadDive().then((dive) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App dive={dive} />
    </StrictMode>,
  ),
)
