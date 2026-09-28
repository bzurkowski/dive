import { useEffect, useRef, useState } from 'react'
import type { Change, Message, SequenceStep, StepViewProps } from '../types'
import { Inline } from '../Inline'
import './diagrams.css'
import { bands, lanes } from './lanes'
import { textWidth, useSize } from './util'

const ROW = 56 // height of a message row
const SELF_ROW = 72 // height of a self-message row
const LOOP = 36 // self-message loop width
const TOP = 12
const BOTTOM = 170 // room for the callout under the last message
const MIN_COL = 120
const NOTE_W = 300
const LABEL_PX = 12.5
const LINK = ' ↗' // after the label of a message that links to a step

// PR change marks. Added and removed use the diff colors; changed gets its own tone.
// Chips are opaque: they sit on the actor box border.
const CHANGE: Record<Change, { tone: string; sign: string; badge: string; chip: string }> = {
  added: { tone: 'text-ok', sign: '+ ', badge: 'new', chip: 'bg-add text-ok' },
  changed: {
    tone: 'text-blue-700 dark:text-blue-300',
    sign: '~ ',
    badge: 'changed',
    chip: 'bg-chg text-blue-700 dark:text-blue-300',
  },
  removed: { tone: 'text-muted', sign: '', badge: 'removed', chip: 'bg-del text-bad' },
}

// Group by app is one choice for every sequence in the dive, remembered when storage works.
const KEY = 'dive-grouped'
let groupedPref = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

// Messages up to `focus` are shown; later ones are faint ghosts.
// The active message carries its note as a callout right under it.
export function SequenceView({ step, focus, onFocus, onJump }: StepViewProps<SequenceStep>) {
  const [ref, { w }] = useSize<HTMLDivElement>()
  const anchor = useRef<HTMLDivElement>(null)
  const [pref, setPref] = useState(groupedPref)
  // Offer grouping only where it merges lanes. Message count and order never change.
  const merged = lanes(step.actors, true)
  const canGroup = merged.lanes.length < step.actors.length
  const grouped = canGroup && pref
  const view = grouped ? merged : lanes(step.actors, false)
  const runs = grouped ? [] : bands(view.lanes)
  const n = Math.max(1, view.lanes.length)

  const toggle = () => {
    groupedPref = !grouped
    try {
      localStorage.setItem(KEY, groupedPref ? '1' : '0')
    } catch {
      // Storage can be blocked; the choice still holds for this visit.
    }
    setPref(groupedPref)
  }

  // Columns fill the stage and fit lane names. Each row has one label,
  // so labels may run past lifelines without colliding.
  let cw = Math.max(MIN_COL, w / n)
  // 42: lane px-2, box px-3 and its border.
  for (const l of view.lanes) cw = Math.max(cw, textWidth(l.label, 13, 600) + 42)
  const width = cw * n
  const x = (id: string) => ((view.of.get(id) ?? 0) + 0.5) * cw
  // Within one lane (same actor, or one collapsed group) a message loops back.
  const isSelf = (m: Message) => view.of.get(m.from) === view.of.get(m.to)

  // y of each message line.
  const ys: number[] = []
  let bottom = TOP
  for (const m of step.messages) {
    ys.push(bottom + 34)
    bottom += isSelf(m) ? SELF_ROW : ROW
  }
  const height = bottom + BOTTOM

  const active = step.messages[focus]
  const aself = active ? isSelf(active) : false
  const ax1 = active ? x(active.from) : 0
  const ax2 = active ? (aself ? ax1 + LOOP : x(active.to)) : 0
  const ay = (ys[focus] ?? 0) + (aself ? 22 : 0)
  const noteW = Math.min(NOTE_W, width - 16)
  const mid = (ax1 + ax2) / 2
  const noteLeft = Math.max(8, Math.min(mid - noteW / 2, width - noteW - 8))
  const jump = active?.step && onJump ? active.step : undefined

  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [focus, step, grouped])

  return (
    <div ref={ref} className="h-full w-full overflow-auto bg-surface">
      <div style={{ width }}>
        <div className="sticky top-0 z-10 bg-surface/90 pb-1 backdrop-blur">
          {canGroup ? (
            <div className="flex justify-end px-2 pt-2 pb-1.5">
              <button
                type="button"
                aria-pressed={grouped}
                onClick={toggle}
                className="sticky right-2 rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-muted hover:text-fg aria-pressed:bg-line/60 aria-pressed:text-fg"
              >
                Group by app
              </button>
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
                      className={`absolute -top-1.5 right-3 rounded px-1 text-[10px] leading-4 font-semibold ${mark.chip}`}
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
            {step.messages.map((m, i) => {
              if (!view.of.has(m.from) || !view.of.has(m.to)) return null
              const on = i === focus
              const self = isSelf(m)
              const mark = m.change && CHANGE[m.change]
              const removed = m.change === 'removed'
              const x1 = x(m.from)
              const x2 = self ? x1 : x(m.to)
              const y = ys[i]
              const dir = self ? -1 : Math.sign(x2 - x1) || 1
              const ey = self ? y + 22 : y // arrow tip
              const dash = removed ? '2 4' : m.type === 'return' ? '5 4' : undefined
              const open = m.type === 'async'
              const line = self ? `M${x1} ${y} h${LOOP} v22 H${x1 + 8}` : `M${x1} ${y} H${x2 - dir * 8}`
              const head = open
                ? `M${x2 - dir * 9} ${ey - 5} L${x2} ${ey} L${x2 - dir * 9} ${ey + 5}`
                : `M${x2} ${ey} l${-dir * 10} -5 v10 z`
              // The active message keeps the reading tone; its change sign stays colored.
              const tone =
                m.type === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : on
                    ? 'text-accent'
                    : mark
                      ? mark.tone
                      : 'text-fg'
              const fade = on ? '' : i < focus ? 'opacity-60 hover:opacity-100' : 'opacity-15 hover:opacity-40'
              const sign = mark ? mark.sign : ''
              const link = m.step ? LINK : ''
              const lw = textWidth(sign + m.label + link, LABEL_PX, 600, true)
              // Left edge of the label. A self label that would run off the right edge sits above its loop.
              const beside = self && x1 + LOOP + 8 + lw <= width - 4
              const tx = beside ? x1 + LOOP + 8 : Math.max(4, Math.min((x1 + x2) / 2 - lw / 2, width - lw - 4))
              const ty = beside ? y + 15 : y - 9
              return (
                <g
                  key={i}
                  className={`${tone} ${fade} cursor-pointer transition-opacity duration-300`}
                  onClick={() => onFocus(i)}
                >
                  <title>{m.label}</title>
                  <rect
                    x={Math.min(x1, x2) - 6}
                    y={y - 26}
                    width={self ? LOOP + lw + 24 : Math.abs(x2 - x1) + 12}
                    height={self ? 56 : 36}
                    fill="transparent"
                  />
                  <path
                    key={on ? `on${focus}` : 'off'}
                    d={line}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={on ? 2 : 1.5}
                    strokeDasharray={dash}
                    pathLength={dash ? undefined : 1}
                    className={on && !dash ? 'dive-draw' : ''}
                  />
                  <path
                    key={on ? `h${focus}` : 'h'}
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
                    {sign && (
                      <tspan fill="currentColor" fontWeight={700} className={mark ? mark.tone : ''}>
                        {sign}
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
                      x2={tx + textWidth(m.label, LABEL_PX, 600, true)}
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

          {active && (
            <div
              ref={anchor}
              className="pointer-events-none absolute scroll-mt-28"
              style={{
                left: Math.min(ax1, ax2) - cw / 2,
                top: ay - 34,
                width: Math.abs(ax2 - ax1) + cw,
                height: 48 + (active.note ? 82 : 0) + (jump ? 30 : 0),
              }}
            />
          )}
          {active && (active.note || jump) && (
            <div
              key={focus}
              className="dive-pop absolute z-[5] rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug shadow-lg"
              style={{ left: noteLeft, top: ay + 14, width: noteW }}
            >
              <div
                className="absolute -top-[7px] h-3 w-3 rotate-45 border-t border-l border-line bg-surface"
                style={{ left: Math.max(12, Math.min(mid - noteLeft - 6, noteW - 24)) }}
              />
              <Inline text={active.note} />
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
          )}
        </div>
      </div>
    </div>
  )
}
