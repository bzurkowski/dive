import type { Dive } from '../types'
import { chapterSeconds, COVER, minutes, type Pos } from './nav'
import { ExternalLink, Links } from './Steps'

const KIND = { pr: 'Pull request', module: 'Module', question: 'Question' }
const primary = 'rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-surface hover:opacity-90'

export function Cover({ dive, go }: { dive: Dive; go: (p: Pos) => void }) {
  const total = chapterSeconds(dive.chapters.flatMap((ch) => ch.steps))
  const { source } = dive
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-muted">
          {KIND[source.kind] ?? 'Dive'}:{' '}
          {source.url ? (
            <ExternalLink href={source.url}>{source.ref}</ExternalLink>
          ) : (
            <span className="text-fg">{source.ref}</span>
          )}
        </p>
        <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-[3.5rem]">
          {dive.title}
        </h1>
        <p className="mt-6 max-w-[62ch] text-xl leading-relaxed">{dive.summary}</p>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" autoFocus onClick={() => go({ c: 0, s: 0, f: 0 })} className={primary}>
            Start the dive
          </button>
          <span className="text-muted">About {minutes(total)} to read</span>
        </div>
        <p className="mt-4 text-sm text-muted">
          Move with <kbd>←</kbd> <kbd>→</kbd>. Press <kbd>g</kbd> for the glossary. Skip to any chapter below.
        </p>

        <ol className="mt-14 border-t border-line">
          {dive.chapters.map((ch, c) => (
            <li key={ch.id} className="border-b border-line">
              <button
                type="button"
                onClick={() => go({ c, s: 0, f: 0 })}
                className="flex w-full items-baseline gap-4 py-4 text-left hover:text-accent"
              >
                <span className="w-6 shrink-0 text-lg text-muted tabular-nums">{c + 1}</span>
                <span className="grow text-lg">{ch.title}</span>
                <span className="shrink-0 text-sm text-muted">
                  {ch.steps.length} {ch.steps.length === 1 ? 'step' : 'steps'}, {minutes(chapterSeconds(ch.steps))}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {!!source.links?.length && (
          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight">Sources</h2>
            <Links links={source.links} />
          </section>
        )}
      </div>
    </main>
  )
}

export function End({ dive, go }: { dive: Dive; go: (p: Pos) => void }) {
  const { source } = dive
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-6 py-24 text-center sm:py-32">
        <span aria-hidden className="mx-auto grid size-16 place-items-center rounded-full bg-ok/15 text-ok">
          <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-6 text-4xl leading-tight font-bold tracking-tight text-balance">You finished the dive</h1>
        <p className="mt-3 text-xl leading-relaxed text-muted">{dive.title}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <button type="button" autoFocus onClick={() => go(COVER)} className={primary}>
            Back to the start
          </button>
          {source.url && (
            <ExternalLink href={source.url}>Open the {(KIND[source.kind] ?? 'source').toLowerCase()}</ExternalLink>
          )}
        </div>
        <p className="mt-6 text-sm text-muted">
          Press <kbd>←</kbd> to go back to the last step.
        </p>
      </div>
    </main>
  )
}
