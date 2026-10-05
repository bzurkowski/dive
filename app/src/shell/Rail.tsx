import type { Dive, Step } from '../types'
import { chapterSeconds, flowAt, flows, minutes, origin, COVER, type Pos } from './nav'

// The title and source of the dive, then chapters on a vertical "depth line" that fills in
// as the reader goes deeper. The flows of the current chapter are smaller stops on it.
// Titles stop at the reading-time column: pr-12 = its min-w-9 plus the gap-3 before it.
export function Rail({ dive, pos, go }: { dive: Dive; pos: Pos; go: (p: Pos) => void }) {
  return (
    <>
      <div className="mb-6 border-b border-line pb-5">
        <button
          type="button"
          onClick={() => go(COVER)}
          className="block rounded text-left text-xl leading-tight font-extrabold tracking-tight text-balance hover:underline"
        >
          {dive.title}
        </button>
        <p className="mt-2 truncate text-sm text-muted">
          {dive.source.url ? (
            <a href={dive.source.url} target="_blank" rel="noreferrer" className="hover:text-fg hover:underline">
              {origin(dive.source)}
            </a>
          ) : (
            origin(dive.source)
          )}
        </p>
      </div>
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
                className="group flex w-full items-baseline justify-between gap-3 rounded text-left"
              >
                <span
                  className={`text-[15px] group-hover:underline ${current ? 'font-semibold' : past ? 'text-fg' : 'text-muted'}`}
                >
                  {ch.title}
                </span>
                <span className="min-w-9 shrink-0 text-right text-xs text-muted">
                  {minutes(chapterSeconds(ch.steps))}
                </span>
              </button>
              {current && <StepList steps={ch.steps} c={c} pos={pos} go={go} />}
            </li>
          )
        })}
      </ol>
    </>
  )
}

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k)

// Steps flush under the chapter title. The dot of a flow sits on the line of the chapter and
// fills once the reader has passed the flow. Only the open flow lists its steps.
// Semibold ink marks the current step. The highlighter stays in the content.
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
        {steps[s].title}
      </button>
    </li>
  )

  return (
    <ol className="mt-2 space-y-2 pr-12">
      {range(0, fl[0]?.s ?? steps.length).map(item)}
      {fl.map((f) => (
        <li key={f.s} className="relative">
          <span
            aria-hidden
            className={`absolute top-[5px] -left-[25px] size-2.5 rounded-full border-2 ring-3 ring-surface ${
              f.end <= pos.s
                ? 'border-accent bg-accent'
                : f === open
                  ? 'border-accent bg-surface'
                  : 'border-muted bg-surface'
            }`}
          />
          <button
            type="button"
            onClick={() => go({ c, s: f.s, f: 0 })}
            aria-current={f.s === pos.s ? 'step' : undefined}
            className={`w-full rounded text-left text-sm leading-snug ${
              f.s === pos.s ? 'font-semibold' : f === open ? 'font-medium' : 'font-medium text-muted hover:text-fg'
            }`}
          >
            {steps[f.s].title}
          </button>
          {f === open && (
            <ol className="mt-1.5 space-y-1">
              {range(f.s + 1, f.edge).map(item)}
              {f.edge < f.end && (
                <li className="flex items-center gap-2 pt-1 text-xs font-semibold text-edge">
                  Edge cases <span aria-hidden className="grow border-t border-dashed border-edge/50" />
                </li>
              )}
              {range(f.edge, f.end).map(item)}
            </ol>
          )}
        </li>
      ))}
    </ol>
  )
}
