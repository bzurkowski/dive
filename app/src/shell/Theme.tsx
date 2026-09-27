import { useState } from 'react'

// index.html sets data-theme before first paint: the saved choice, else the OS setting.
const root = document.documentElement

export function ThemeButton({ className = '' }: { className?: string }) {
  const [dark, setDark] = useState(root.dataset.theme === 'dark')
  const label = `Switch to ${dark ? 'light' : 'dark'} theme`
  const flip = () => {
    const theme = dark ? 'light' : 'dark'
    root.dataset.theme = theme
    try {
      localStorage.setItem('dive-theme', theme)
    } catch {
      // Storage can be blocked (private mode, some file:// setups); the switch still works for this visit.
    }
    setDark(!dark)
  }
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded p-1.5 text-muted hover:text-fg ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  )
}
