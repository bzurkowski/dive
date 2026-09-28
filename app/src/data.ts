import type { Dive } from './types'

// In dev the data tag holds a placeholder: fetch public/<?data=name>.json instead.
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
