import { useLayoutEffect, useRef, useState } from 'react'

// Content-box size of an element, kept up to date.
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Measure before the first paint, so the first frame already fits.
    const cs = getComputedStyle(el)
    const pad = (a: string, b: string) => parseFloat(cs.getPropertyValue(a)) + parseFloat(cs.getPropertyValue(b))
    setSize({
      w: el.clientWidth - pad('padding-left', 'padding-right'),
      h: el.clientHeight - pad('padding-top', 'padding-bottom'),
    })
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

const ctx = document.createElement('canvas').getContext('2d')
const families: Record<string, string> = {}

// Rendered width of `text` in the page's sans or mono font.
export function textWidth(text: string, px: number, weight = 400, mono = false): number {
  if (!ctx) return text.length * px * 0.6
  const key = mono ? 'mono' : 'sans'
  families[key] ??= mono
    ? getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace'
    : getComputedStyle(document.body).fontFamily
  ctx.font = `${weight} ${px}px ${families[key]}`
  return ctx.measureText(text).width
}
