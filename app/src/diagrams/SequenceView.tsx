import { useEffect, useRef, useState } from 'react'
import type { Change, SequenceStep, StepViewProps } from '../types'
import { Inline } from '../Inline'
import './diagrams.css'
import { actorLabel, bands, cut, lanes } from './lanes'
import { textWidth, useSize } from './util'

const ROW = 56 // height of a message row
const SELF_ROW = 72 // height of a self-message row
const LOOP = 36 // self-message loop width
const DROP = 22 // self-message loop height
const TOP = 12
const BOTTOM = 170 // room for the callout under the last message
const MIN_COL = 96 // narrowest lane: past it the lanes group, then scroll
const NOTE_W = 300
const LABEL_PX = 12.5
const LINK = ' ↗' // after the label of a message that links to a step

// Chips are opaque: they sit on the actor box border.
const CHANGE: Record<Change, { tone: string; sign: string; badge: string; chip: string }> = {
  added: { tone: 'text-ok', sign: '+ ', badge: 'new', chip: 'bg-add text-ok' },
  changed: { tone: 'text-chg-ink', sign: '~ ', badge: 'changed', chip: 'bg-chg text-chg-ink' },
  removed: { tone: 'text-muted', sign: '', badge: 'removed', chip: 'bg-del text-bad' },
}

// Group by app is one choice for every sequence in the dive. Until the reader
// makes it, a sequence groups when its lanes don't fit. Storage can be blocked;
// the choice then holds for this visit only.
const KEY = 'dive-grouped'
let groupedPref: boolean | undefined
try {
  const v = localStorage.getItem(KEY)
  if (v) groupedPref = v === '1'
} catch {}

// Messages up to `focus` are shown; later ones are faint ghosts.
// The active message carries its note as a callout right under it.
export function SequenceView({ step, focus, onFocus, onJump }: StepViewProps<SequenceStep>) {
  const [ref, { w }] = useSize<HTMLDivElement>()
  const anchor = useRef<HTMLDivElement>(null)
  const [pref, setPref] = useState(groupedPref)
  const [scrollX, setScrollX] = useState(0)
  // Offer grouping only where it merges lanes.
  const merged = lanes(step.actors, true)
  const canGroup = merged.lanes.length < step.actors.length
  const grouped = canGroup && (pref ?? step.actors.length * MIN_COL > w)
  const view = grouped ? merged : lanes(step.actors, false)
  const runs = grouped ? [] : bands(view.lanes)
  const n = view.lanes.length

  const toggle = () => {
    groupedPref = !grouped
    try {
      localStorage.setItem(KEY, groupedPref ? '1' : '0')
    } catch {}
    setPref(groupedPref)
  }

  // Columns share the stage down to MIN_COL; a longer lane name truncates. Each row
  // has one label, so labels may run past lifelines without colliding.
  const cw = Math.max(MIN_COL, w / n)
  const width = cw * n
  // Lanes past the stage's edges get a hint that scrolls to them.
  const [cutL, cutR] = cut(n, cw, scrollX, w)
  const hint = (k: number, dir: -1 | 1) => {
    if (!k) return null
    const count = `${k} ${k === 1 ? 'lane' : 'lanes'}`
    return (
      <button
        type="button"
        onClick={() => ref.current?.scrollBy({ left: dir * Math.max(cw, w - cw) })}
        aria-label={`Show ${count} on the ${dir < 0 ? 'left' : 'right'}`}
        className={`rounded px-1 py-0.5 text-xs text-muted hover:text-fg ${dir < 0 ? 'sticky left-2' : ''}`}
      >
        {dir < 0 ? `← ${count}` : `${count} →`}
      </button>
    )
  }
  const x = (id: string) => (view.of.get(id)! + 0.5) * cw

  // y is the message line, ey the arrow tip.
  const rows = []
  let bottom = TOP
  for (const m of step.messages) {
    const x1 = x(m.from)
    const x2 = x(m.to)
    // Within one lane (same actor, or one collapsed group) a message loops back.
    const self = x1 === x2
    const y = bottom + 34
    rows.push({ m, x1, x2, self, y, ey: self ? y + DROP : y, mid: self ? x1 + LOOP / 2 : (x1 + x2) / 2 })
    bottom += self ? SELF_ROW : ROW
  }
  const height = bottom + BOTTOM

  const active = rows[focus]
  const noteW = Math.min(NOTE_W, width - 16)
  const noteLeft = Math.max(8, Math.min(active.mid - noteW / 2, width - noteW - 8))
  const anchorLeft = Math.min(active.x1 - cw / 2, active.x2 - cw / 2, noteLeft)
  const anchorW = Math.max(active.x1 + cw / 2, active.x2 + cw / 2, noteLeft + noteW) - anchorLeft
  const jump = active.m.step && onJump ? active.m.step : undefined
  const tw = (s: string) => textWidth(s, LABEL_PX, 600, true)

  // Wait for the stage's width: grouping, and so the rows, depend on it.
  useEffect(() => {
    if (w) anchor.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focus, step, grouped, w])

  return (
    <div
      ref={ref}
      onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
      className="h-full w-full overflow-auto bg-surface motion-safe:scroll-smooth"
    >
      <div style={{ width }}>
        <div className="sticky top-0 z-10 bg-surface/90 pb-1 backdrop-blur">
          {canGroup || cutL || cutR ? (
            <div className="flex items-center px-2 pt-2 pb-1.5">
              {hint(cutL, -1)}
              <div className="sticky right-2 ml-auto flex items-center gap-2">
                {hint(cutR, 1)}
                {canGroup && (
                  <button
                    type="button"
                    aria-pressed={grouped}
                    onClick={toggle}
                    className="rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-muted hover:text-fg aria-pressed:bg-line/60 aria-pressed:text-fg"
                  >
                    Group by app
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-4" />
          )}
          {runs.length > 0 && (
            <div className="relative mb-2 h-5">
              {runs.map((b) => (
                <div
                  key={b.start}
                  className="absolute inset-y-0 truncate rounded-md border border-line bg-line/40 px-2 text-center text-[11px] leading-[18px] font-semibold tracking-wider text-muted uppercase"
                  style={{ left: b.start * cw + 8, width: b.n * cw - 16 }}
                  title={b.group}
                >
                  {b.group}
                </div>
              ))}
            </div>
          )}
          <div className="flex">
            {view.lanes.map((l, i) => {
              const group = grouped && l.group !== undefined
              const mark = !group && l.actors[0].change && CHANGE[l.actors[0].change]
              return (
                <div key={i} className="relative shrink-0 px-2" style={{ width: cw }}>
                  <div
                    className="truncate rounded-lg border border-line bg-bg px-3 py-2 text-center text-[13px] font-semibold"
                    title={group ? `${l.label}: ${l.actors.map((a) => a.label).join(', ')}` : l.label}
                  >
                    {l.label}
                  </div>
                  {mark && (
                    <span
                      className={`absolute -top-1.5 right-3 rounded px-1 text-xs leading-4 font-semibold ${mark.chip}`}
                    >
                      {mark.badge}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative">
          <svg width={width} height={height} className="block" role="img" aria-label={step.title}>
            {view.lanes.map((_, i) => (
              <line
                key={i}
                x1={(i + 0.5) * cw}
                x2={(i + 0.5) * cw}
                y1={0}
                y2={height}
                className="stroke-line"
                strokeDasharray="4 4"
              />
            ))}
            {rows.map(({ m, x1, x2, self, y, ey, mid }, i) => {
              const on = i === focus
              const mark = m.change && CHANGE[m.change]
              const removed = m.change === 'removed'
              const dir = self ? -1 : Math.sign(x2 - x1)
              const dash = removed ? '2 4' : m.type === 'return' ? '5 4' : undefined
              const open = m.type === 'async'
              // A filled head covers the last 8px of the line; an open one needs the line up to its tip.
              const end = x2 - dir * (open ? 0 : 8)
              const line = self ? `M${x1} ${y} h${LOOP} v${DROP} H${end}` : `M${x1} ${y} H${end}`
              const head = open
                ? `M${x2 - dir * 9} ${ey - 5} L${x2} ${ey} L${x2 - dir * 9} ${ey + 5}`
                : `M${x2} ${ey} l${-dir * 10} -5 v10 z`
              // The active message keeps the reading tone; its change sign stays colored.
              const tone = m.type === 'error' ? 'text-bad' : on ? 'text-accent' : mark ? mark.tone : 'text-fg'
              const fade = on ? '' : i < focus ? 'opacity-60 hover:opacity-100' : 'opacity-15 hover:opacity-40'
              const link = m.step && onJump ? LINK : ''
              const lw = tw((mark?.sign ?? '') + m.label + link)
              // A self label that would run off the right edge sits above its loop.
              const beside = self && x1 + LOOP + 8 + lw <= width - 4
              const tx = beside ? x1 + LOOP + 8 : Math.max(4, Math.min(mid - lw / 2, width - lw - 4))
              const ty = beside ? y + 15 : y - 9
              // The hit area spans the line and its label.
              const hx = Math.min(x1, x2, tx) - 6
              return (
                <g
                  key={i}
                  className={`${tone} ${fade} cursor-pointer transition-opacity duration-300`}
                  onClick={() => onFocus(i)}
                >
                  <title>{m.label}</title>
                  <rect
                    x={hx}
                    y={y - 26}
                    width={Math.max(self ? x1 + LOOP : x2, x1, tx + lw) + 6 - hx}
                    height={self ? 56 : 36}
                    fill="transparent"
                  />
                  <path
                    d={line}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={on ? 2 : 1.5}
                    strokeDasharray={dash}
                    pathLength={dash ? undefined : 1}
                    className={on && !dash ? 'dive-draw' : ''}
                  />
                  <path
                    d={head}
                    fill={open ? 'none' : 'currentColor'}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                    className={on ? 'dive-head' : ''}
                  />
                  {on && <rect x={tx - 4} y={ty - 13} width={lw + 8} height={18} rx={2} className="fill-mark" />}
                  <text
                    x={tx}
                    y={ty}
                    fill="currentColor"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className={`${on ? 'stroke-mark' : 'stroke-surface'} font-mono`}
                    fontSize={LABEL_PX}
                    fontWeight={on ? 600 : 400}
                  >
                    {mark?.sign && (
                      <tspan fill="currentColor" fontWeight={700} className={mark.tone}>
                        {mark.sign}
                      </tspan>
                    )}
                    {m.label}
                    {link && (
                      <tspan fill="currentColor" className="text-muted">
                        {link}
                      </tspan>
                    )}
                  </text>
                  {removed && (
                    <line
                      x1={tx}
                      x2={tx + tw(m.label)}
                      y1={ty - 4}
                      y2={ty - 4}
                      stroke="currentColor"
                      strokeWidth={1.25}
                    />
                  )}
                </g>
              )
            })}
          </svg>
          {/* To a screen reader the svg is one image: the messages as text, in order. */}
          <ol className="sr-only">
            {step.messages.map((m, i) => (
              <li key={i} aria-current={i === focus ? 'step' : undefined}>
                {actorLabel(step.actors, m.from)} → {actorLabel(step.actors, m.to)}: {m.label}
              </li>
            ))}
          </ol>

          {/* Scroll target: the lanes of the active message and its callout, from its row to the callout's end. */}
          <div
            ref={anchor}
            className="pointer-events-none absolute scroll-mt-28 scroll-mb-8 pt-12"
            style={{ left: anchorLeft, top: active.ey - 34, width: anchorW }}
          >
            <div
              key={focus}
              className="dive-pop pointer-events-auto relative z-[5] rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug shadow-lg"
              style={{ marginLeft: noteLeft - anchorLeft, width: noteW }}
            >
              <div
                className="absolute -top-[7px] h-3 w-3 rotate-45 border-t border-l border-line bg-surface"
                style={{ left: Math.max(12, Math.min(active.mid - noteLeft - 6, noteW - 24)) }}
              />
              <Inline text={active.m.note} />
              {jump && (
                <button
                  type="button"
                  onClick={() => onJump?.(jump)}
                  className="mt-1.5 block text-[13px] font-semibold text-accent hover:underline"
                >
                  {step.kind === 'sequence' ? 'Go to flow →' : 'Show code →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
