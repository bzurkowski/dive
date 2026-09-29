import type { Dive, Step } from '../types'
import { chapterSeconds, flowAt, flows, minutes, type Pos } from './nav'

// Chapters on a vertical "depth line" that fills in as the reader goes deeper.
export function Rail({ dive, pos, go }: { dive: Dive; pos: Pos; go: (p: Pos) => void }) {
  return (
    <ol>
      {dive.chapters.map((ch, c) => {
        const current = c === pos.c
        const past = c < pos.c
        return (
          <li key={ch.id} className="relative pb-5 pl-8">
            {c < dive.chapters.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-3 -bottom-3 left-[11px] w-0.5 ${past ? 'bg-accent' : 'bg-line'}`}
              />
            )}
            <span
              aria-hidden
              className={`absolute top-1.5 left-1.5 size-3 rounded-full border-2 ${
                past
                  ? 'border-accent bg-accent'
                  : current
                    ? 'border-accent bg-surface ring-4 ring-accent/20'
                    : 'border-line bg-surface'
              }`}
            />
            <button
              type="button"
              onClick={() => go({ c, s: 0, f: 0 })}
              aria-current={current || undefined}
              className="flex w-full items-baseline justify-between gap-3 rounded text-left"
            >
              <span className={`text-[15px] ${current ? 'font-semibold' : past ? 'text-fg' : 'text-muted'}`}>
                {ch.title}
              </span>
              <span className="shrink-0 text-xs text-muted">{minutes(chapterSeconds(ch.steps))}</span>
            </button>
            {current && <StepList steps={ch.steps} c={c} pos={pos} go={go} />}
          </li>
        )
      })}
    </ol>
  )
}

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k)

function StepList({ steps, c, pos, go }: { steps: Step[]; c: number; pos: Pos; go: (p: Pos) => void }) {
  const fl = flows(steps)
  const open = flowAt(fl, pos.s)
  const item = (s: number) => (
    <li key={s}>
      <button
        type="button"
        onClick={() => go({ c, s, f: 0 })}
        aria-current={s === pos.s ? 'step' : undefined}
        className={`w-full rounded text-left text-sm leading-snug ${s === pos.s ? 'font-semibold' : 'text-muted hover:text-fg'}`}
      >
        <span className={s === pos.s ? 'mark' : ''}>{steps[s].title}</span>
      </button>
    </li>
  )

  return (
    <ol className="mt-2 space-y-1 border-l border-line pl-3">
      {range(0, fl[0]?.s ?? steps.length).map(item)}
      {fl.map((f) => (
        <li key={f.s} className="pt-1">
          <button
            type="button"
            onClick={() => go({ c, s: f.s, f: 0 })}
            aria-current={f.s === pos.s ? 'step' : undefined}
            className={`flex w-full items-baseline gap-2 rounded text-left text-sm leading-snug ${
              f.s === pos.s ? 'font-semibold' : f === open ? 'font-medium' : 'font-medium text-muted hover:text-fg'
            }`}
          >
            <FlowGlyph />
            <span className={`grow ${f.s === pos.s ? 'mark' : ''}`}>{steps[f.s].title}</span>
            <span className="shrink-0 text-xs font-normal text-muted">
              {minutes(chapterSeconds(steps.slice(f.s, f.end)))}
            </span>
          </button>
          {f === open && f.s + 1 < f.end && (
            <ol className="mt-1.5 ml-[7px] space-y-1 border-l border-line pl-6">
              {range(f.s + 1, f.edge).map(item)}
              {f.edge < f.end && (
                <li className="pt-1">
                  <p className="text-xs font-semibold">Edge cases</p>
                  <ol className="mt-1 space-y-1 border-l border-dashed border-edge/60 pl-3">
                    {range(f.edge, f.end).map(item)}
                  </ol>
                </li>
              )}
            </ol>
          )}
        </li>
      ))}
    </ol>
  )
}

// Two lifelines with a call and its return: marks a flow header.
function FlowGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 translate-y-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 1.5v13M13.5 1.5v13" />
      <path d="M5 5.5h6M9 3.5l2 2-2 2" />
      <path d="M11 10.5H5M7 8.5l-2 2 2 2" />
    </svg>
  )
}
