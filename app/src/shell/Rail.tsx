import type { Dive } from '../types'
import { chapterSeconds, minutes, type Pos } from './nav'

// Chapters on a vertical "depth line". The line fills in as the reader goes deeper.
// Steps of the current chapter are listed under it.
export function Rail({ dive, pos, go }: { dive: Dive; pos: Pos; go: (p: Pos) => void }) {
  const last = dive.chapters.findLastIndex((ch) => ch.steps.length)
  return (
    <ol>
      {dive.chapters.map((ch, c) => {
        if (!ch.steps.length) return null
        const current = c === pos.c
        const past = c < pos.c
        return (
          <li key={ch.id} className="relative pb-5 pl-8">
            {c !== last && (
              <span aria-hidden className={`absolute top-3 bottom-0 left-[11px] w-0.5 ${past ? 'bg-accent' : 'bg-line'}`} />
            )}
            <span
              aria-hidden
              className={`absolute top-1.5 left-1.5 size-3 rounded-full border-2 ${
                past ? 'border-accent bg-accent' : current ? 'border-accent bg-surface ring-4 ring-accent/20' : 'border-line bg-surface'
              }`}
            />
            <button
              type="button"
              onClick={() => go({ c, s: 0, f: 0 })}
              aria-current={current ? 'step' : undefined}
              className="flex w-full items-baseline justify-between gap-3 rounded text-left"
            >
              <span className={`text-[15px] ${current ? 'font-semibold' : past ? 'text-fg' : 'text-muted'}`}>{ch.title}</span>
              <span className="shrink-0 text-xs text-muted">{minutes(chapterSeconds(ch.steps))}</span>
            </button>
            {current && (
              <ol className="mt-2 space-y-1 border-l border-line pl-3">
                {ch.steps.map((st, s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => go({ c, s, f: 0 })}
                      aria-current={s === pos.s ? 'step' : undefined}
                      className={`w-full rounded text-left text-sm leading-snug ${s === pos.s ? 'font-medium text-accent' : 'text-muted hover:text-fg'}`}
                    >
                      {st.title}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </li>
        )
      })}
    </ol>
  )
}
