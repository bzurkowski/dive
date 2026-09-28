import dagre from '@dagrejs/dagre'
import { useMemo } from 'react'
import type { DiagramStep, StepViewProps } from '../types'
import { Inline } from '../Inline'
import './diagrams.css'
import { textWidth, useSize } from './util'

// Full class names so Tailwind picks them up.
const TINTS = [
  { fill: 'fill-sky-500/10', stroke: 'stroke-sky-500/60', swatch: 'bg-sky-500/40' },
  { fill: 'fill-fuchsia-500/10', stroke: 'stroke-fuchsia-500/60', swatch: 'bg-fuchsia-500/40' },
  { fill: 'fill-emerald-500/10', stroke: 'stroke-emerald-500/60', swatch: 'bg-emerald-500/40' },
  { fill: 'fill-violet-500/10', stroke: 'stroke-violet-500/60', swatch: 'bg-violet-500/40' },
  { fill: 'fill-rose-500/10', stroke: 'stroke-rose-500/60', swatch: 'bg-rose-500/40' },
  { fill: 'fill-teal-500/10', stroke: 'stroke-teal-500/60', swatch: 'bg-teal-500/40' },
]
const PLAIN = { fill: 'fill-bg', stroke: 'stroke-muted/50' }

const NODE_PX = 14
const EDGE_PX = 11.5
const LINE_H = 18

type Pt = { x: number; y: number }
type Node = DiagramStep['nodes'][number] & { lines: string[]; x: number; y: number; width: number; height: number }
type Laid = {
  width: number
  height: number
  nodes: Node[]
  edges: { i: number; pts: Pt[]; label?: Pt & { width: number; height: number } }[]
}

// Split a long label into two lines at the space nearest the middle.
function wrap(label: string): string[] {
  if (label.length <= 24) return [label]
  const mid = label.length / 2
  let cut = -1
  for (let i = 0; i < label.length; i++)
    if (label[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i
  return cut < 0 ? [label] : [label.slice(0, cut), label.slice(cut + 1)]
}

function layout(step: DiagramStep, rankdir: 'LR' | 'TB'): Laid {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir, nodesep: 24, ranksep: 48, edgesep: 12, marginx: 12, marginy: 12 })
  for (const n of step.nodes) {
    const lines = wrap(n.label)
    const width = Math.max(96, ...lines.map((l) => textWidth(l, NODE_PX, 500) + 28))
    g.setNode(n.id, { ...n, lines, width, height: 20 + lines.length * LINE_H })
  }
  step.edges.forEach((e, i) => {
    const label = e.label ? { width: textWidth(e.label, EDGE_PX) + 12, height: 18, labelpos: 'c' } : {}
    g.setEdge(e.from, e.to, label, String(i))
  })
  dagre.layout(g)
  return {
    width: g.graph().width,
    height: g.graph().height,
    // One per id: a repeated id overwrites the earlier node.
    nodes: g.nodes().map((id) => g.node(id)),
    edges: g.edges().map((e) => {
      const d = g.edge(e)
      return {
        i: Number(e.name),
        pts: e.v === e.w ? loop(g.node(e.v), d, rankdir) : d.points,
        label: d.width ? d : undefined,
      }
    }),
  }
}

// dagre 3 misplaces self-loop points, so loop out to the spot it reserves (`at`):
// right of the node in TB, below it in LR.
function loop(n: Node, at: Pt, rankdir: 'LR' | 'TB'): Pt[] {
  const k = 14
  if (rankdir === 'TB') {
    const x = n.x + n.width / 2
    return [
      { x, y: n.y - k },
      { x: at.x, y: n.y - k },
      { x: at.x, y: n.y + k },
      { x, y: n.y + k },
    ]
  }
  const y = n.y + n.height / 2
  return [
    { x: n.x - k, y },
    { x: n.x - k, y: at.y },
    { x: n.x + k, y: at.y },
    { x: n.x + k, y },
  ]
}

function curve(p: Pt[]): string {
  let d = `M${p[0].x} ${p[0].y}`
  for (let i = 1; i < p.length - 1; i++)
    d += ` Q${p[i].x} ${p[i].y} ${(p[i].x + p[i + 1].x) / 2} ${(p[i].y + p[i + 1].y) / 2}`
  const last = p[p.length - 1]
  return `${d} L${last.x} ${last.y}`
}

// Box-and-arrow diagram, built up note by note. Each note focuses a set of nodes:
// they and the edges between them are highlighted, nodes of earlier notes dim,
// and nodes no note has reached yet are faint ghosts. Without notes all shows.
export function DiagramView({ step, focus, onFocus }: StepViewProps<DiagramStep>) {
  const [ref, { w, h }] = useSize<HTMLDivElement>()
  const both = useMemo(() => ({ LR: layout(step, 'LR'), TB: layout(step, 'TB') }), [step])
  const fit = (l: Laid) => Math.min(w / l.width, h / l.height)
  const l = w && h && fit(both.TB) > fit(both.LR) ? both.TB : both.LR
  // Keep text readable: below 0.85 the diagram scrolls instead of shrinking.
  const s = w && h ? Math.max(0.85, Math.min(1.25, fit(l))) : 1

  const notes = step.notes ?? []
  const note = notes[focus]
  const on = new Set(note?.focus)
  const seen = new Set(notes.slice(0, focus + 1).flatMap((n) => n.focus))
  const fade = (lit: boolean, ...ids: string[]) =>
    !note || lit ? '' : ids.every((id) => seen.has(id)) ? 'opacity-60' : 'opacity-15'
  const groups = [...new Set(step.nodes.flatMap((n) => (n.group ? [n.group] : [])))]

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      <div ref={ref} className="relative flex min-h-0 flex-1 overflow-auto p-4">
        {groups.length > 0 && (
          <div className="absolute top-3 right-4 z-10 flex flex-wrap gap-3 text-xs text-muted">
            {groups.map((g, i) => (
              <span key={g} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${TINTS[i % TINTS.length].swatch}`} />
                {g}
              </span>
            ))}
          </div>
        )}
        <svg
          width={l.width * s}
          height={l.height * s}
          viewBox={`0 0 ${l.width} ${l.height}`}
          className="m-auto block shrink-0"
          role="img"
          aria-label={step.title}
        >
          {l.edges.map(({ i, pts, label }) => {
            const e = step.edges[i]
            const lit = on.has(e.from) && on.has(e.to)
            const [a, b] = pts.slice(-2)
            const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
            return (
              <g
                key={i}
                className={`transition-opacity duration-300 ${lit ? 'text-accent' : 'text-muted'} ${fade(lit, e.from, e.to)}`}
              >
                <path d={curve(pts)} fill="none" stroke="currentColor" strokeWidth={lit ? 2 : 1.25} />
                <path
                  d="M0 0 L-10 -5 L-10 5 Z"
                  fill="currentColor"
                  transform={`translate(${b.x} ${b.y}) rotate(${deg})`}
                />
                {label && (
                  <>
                    <rect
                      x={label.x - label.width / 2}
                      y={label.y - label.height / 2}
                      width={label.width}
                      height={label.height}
                      rx={4}
                      className="fill-surface"
                    />
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="currentColor"
                      fontSize={EDGE_PX}
                    >
                      {e.label}
                    </text>
                  </>
                )}
              </g>
            )
          })}
          {l.nodes.map((n) => {
            const t = n.group ? TINTS[groups.indexOf(n.group) % TINTS.length] : PLAIN
            const lit = on.has(n.id)
            const to = lit ? -1 : notes.findIndex((x) => x.focus.includes(n.id))
            return (
              <g
                key={n.id}
                transform={`translate(${n.x - n.width / 2} ${n.y - n.height / 2})`}
                className={`transition-opacity duration-300 ${fade(lit, n.id)} ${to >= 0 ? 'cursor-pointer hover:opacity-80' : ''}`}
                onClick={to >= 0 ? () => onFocus(to) : undefined}
              >
                <rect
                  width={n.width}
                  height={n.height}
                  rx={10}
                  strokeWidth={lit ? 2 : 1}
                  className={`transition-all duration-300 ${t.fill} ${lit ? 'stroke-accent' : t.stroke}`}
                />
                <text
                  x={n.width / 2}
                  y={n.height / 2 - ((n.lines.length - 1) * LINE_H) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={NODE_PX}
                  fontWeight={lit ? 600 : 500}
                  className="fill-fg"
                >
                  {n.lines.map((line, k) => (
                    <tspan key={k} x={n.width / 2} dy={k ? LINE_H : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {note && (
        <div className="flex items-start gap-4 border-t border-line px-6 py-3.5">
          {notes.length > 1 && (
            <div className="flex shrink-0 gap-1.5 pt-2">
              {notes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Note ${i + 1} of ${notes.length}`}
                  aria-current={i === focus ? 'step' : undefined}
                  onClick={() => onFocus(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${i === focus ? 'bg-accent' : 'bg-line hover:bg-muted'}`}
                />
              ))}
            </div>
          )}
          <p key={focus} className="dive-pop max-w-3xl text-[15px] leading-relaxed">
            <Inline text={note.text} />
          </p>
        </div>
      )}
    </div>
  )
}
