import { useLayoutEffect, useRef, useState } from 'react'

export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Measure now: React renders a ResizeObserver update only after the first paint.
    // clientWidth includes the padding, which the content box of the observer does not.
    const cs = getComputedStyle(el)
    setSize({
      w: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      h: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
    })
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

const ctx = document.createElement('canvas').getContext('2d')
const families: Record<string, string> = {}

export function textWidth(text: string, px: number, weight = 400, mono = false): number {
  if (!ctx) return text.length * px * 0.6
  const v = mono ? '--font-mono' : '--font-sans'
  families[v] ??= getComputedStyle(document.documentElement).getPropertyValue(v)
  ctx.font = `${weight} ${px}px ${families[v]}`
  return ctx.measureText(text).width
}
