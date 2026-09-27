import { useEffect, useRef } from 'react'
import type { SequenceStep, StepViewProps } from '../types'
import { Inline } from '../Inline'
import './diagrams.css'
import { textWidth, useSize } from './util'

const ROW = 56 // height of a message row
const SELF_ROW = 72 // height of a self-message row
const LOOP = 36 // self-message loop width
const TOP = 12
const BOTTOM = 140 // room for the callout under the last message
const MIN_COL = 120
const NOTE_W = 300
const LABEL_PX = 12.5

// Messages up to `focus` are shown; later ones are faint ghosts.
// The active message carries its note as a callout right under it.
export function SequenceView({ step, focus, onFocus }: StepViewProps<SequenceStep>) {
  const [ref, { w }] = useSize<HTMLDivElement>()
  const anchor = useRef<HTMLDivElement>(null)
  const col = new Map(step.actors.map((a, i) => [a.id, i]))
  const n = Math.max(1, step.actors.length)

  // Columns fill the stage and fit actor names. Each row has one label,
  // so labels may run past lifelines without colliding.
  let cw = Math.max(MIN_COL, w / n)
  for (const a of step.actors) cw = Math.max(cw, textWidth(a.label, 13, 600) + 32)
  const width = cw * n
  const x = (id: string) => ((col.get(id) ?? 0) + 0.5) * cw

  // y of each message line.
  const ys: number[] = []
  let bottom = TOP
  for (const m of step.messages) {
    ys.push(bottom + 34)
    bottom += m.from === m.to ? SELF_ROW : ROW
  }
  const height = bottom + BOTTOM

  const active = step.messages[focus]
  const ax1 = active ? x(active.from) : 0
  const ax2 = active ? (active.from === active.to ? ax1 + LOOP : x(active.to)) : 0
  const ay = (ys[focus] ?? 0) + (active?.from === active?.to ? 22 : 0)
  const noteW = Math.min(NOTE_W, width - 16)
  const mid = (ax1 + ax2) / 2
  const noteLeft = Math.max(8, Math.min(mid - noteW / 2, width - noteW - 8))

  useEffect(() => {
    anchor.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [focus, step])

  return (
    <div ref={ref} className="h-full w-full overflow-auto bg-surface">
      <div style={{ width }}>
        <div className="sticky top-0 z-10 flex bg-surface/90 pt-4 pb-1 backdrop-blur">
          {step.actors.map((a) => (
            <div key={a.id} className="shrink-0 px-2" style={{ width: cw }}>
              <div
                className="truncate rounded-lg border border-line bg-bg px-3 py-2 text-center text-[13px] font-semibold"
                title={a.label}
              >
                {a.label}
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <svg width={width} height={height} className="block" role="img" aria-label={step.title}>
            {step.actors.map((a) => (
              <line key={a.id} x1={x(a.id)} x2={x(a.id)} y1={0} y2={height} className="stroke-line" strokeDasharray="4 4" />
            ))}
            {step.messages.map((m, i) => {
              if (!col.has(m.from) || !col.has(m.to)) return null
              const on = i === focus
              const self = m.from === m.to
              const x1 = x(m.from)
              const x2 = self ? x1 : x(m.to)
              const y = ys[i]
              const dir = self ? -1 : Math.sign(x2 - x1) || 1
              const ey = self ? y + 22 : y // arrow tip
              const dashed = m.type === 'return'
              const open = m.type === 'async'
              const line = self ? `M${x1} ${y} h${LOOP} v22 H${x1 + 8}` : `M${x1} ${y} H${x2 - dir * 8}`
              const head = open
                ? `M${x2 - dir * 9} ${ey - 5} L${x2} ${ey} L${x2 - dir * 9} ${ey + 5}`
                : `M${x2} ${ey} l${-dir * 10} -5 v10 z`
              const tone = m.type === 'error' ? 'text-red-600 dark:text-red-400' : on ? 'text-accent' : 'text-fg'
              const fade = on ? '' : i < focus ? 'opacity-60 hover:opacity-100' : 'opacity-15 hover:opacity-40'
              const lw = textWidth(m.label, LABEL_PX, 600, true)
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
                    strokeDasharray={dashed ? '5 4' : undefined}
                    pathLength={dashed ? undefined : 1}
                    className={on && !dashed ? 'dive-draw' : ''}
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
                  <text
                    x={self ? x1 + LOOP + 8 : Math.max(lw / 2 + 4, Math.min((x1 + x2) / 2, width - lw / 2 - 4))}
                    y={self ? y + 15 : y - 9}
                    textAnchor={self ? 'start' : 'middle'}
                    fill="currentColor"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="stroke-surface font-mono"
                    fontSize={LABEL_PX}
                    fontWeight={on ? 600 : 400}
                  >
                    {m.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {active && (
            <div
              ref={anchor}
              className="pointer-events-none absolute scroll-mt-20"
              style={{ left: Math.min(ax1, ax2) - cw / 2, top: ay - 34, width: Math.abs(ax2 - ax1) + cw, height: active.note ? 130 : 48 }}
            />
          )}
          {active?.note && (
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
