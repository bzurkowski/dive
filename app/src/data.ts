import type { Dive } from './types'

// Baked dives carry their data inline. In dev the tag holds a placeholder,
// so fall back to fetching public/<?data=name>.json (default dive.json).
export async function loadDive(): Promise<Dive> {
  const inline = document.getElementById('dive-data')?.textContent ?? ''
  try {
    return JSON.parse(inline) as Dive
  } catch {
    const name = new URLSearchParams(location.search).get('data') ?? 'dive'
    const res = await fetch(`${name}.json`)
    return (await res.json()) as Dive
  }
}
