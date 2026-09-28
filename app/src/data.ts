import type { Dive } from './types'

// Baked dives carry their data inline. In dev the tag holds a placeholder,
// so fall back to fetching public/<?data=name>.json (default dive.json).
export async function loadDive(): Promise<Dive> {
  const inline = document.getElementById('dive-data')?.textContent ?? ''
  try {
    return JSON.parse(inline) as Dive
  } catch {
    const file = `${new URLSearchParams(location.search).get('data') || 'dive'}.json`
    const res = await fetch(file)
    if (!res.ok) throw new Error(`${file}: ${res.status} ${res.statusText}`)
    return (await res.json()) as Dive
  }
}
