import type { Dive } from '../types'
import { chapterSeconds, minutes, type Pos } from './nav'
import { Links } from './Steps'

const KIND = { pr: 'Pull request', module: 'Module', question: 'Question', doc: 'Page' }

export function Cover({ dive, go }: { dive: Dive; go: (p: Pos) => void }) {
  const chapters = dive.chapters.map((ch, c) => ({ ch, c })).filter(({ ch }) => ch.steps.length)
  const total = chapters.reduce((n, { ch }) => n + chapterSeconds(ch.steps), 0)
  const { source } = dive
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-muted">
          {KIND[source.kind] ?? 'Dive'}:{' '}
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
              {source.ref}
            </a>
          ) : (
            <span className="text-fg">{source.ref}</span>
          )}
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.1] font-semibold text-balance sm:text-5xl">{dive.title}</h1>
        <p className="mt-6 max-w-[62ch] text-xl leading-relaxed">{dive.summary}</p>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="button"
            autoFocus
            onClick={() => go({ c: chapters[0]?.c ?? 0, s: 0, f: 0 })}
            className="rounded-lg bg-accent px-6 py-3 text-lg font-semibold text-surface hover:opacity-90"
          >
            Start the dive
          </button>
          <span className="text-muted">About {minutes(total)} to read</span>
        </div>
        <p className="mt-4 text-sm text-muted">
          Move with <kbd>←</kbd> <kbd>→</kbd>. Press <kbd>g</kbd> for the glossary. Skip to any chapter below.
        </p>

        <ol className="mt-14 border-t border-line">
          {chapters.map(({ ch, c }, i) => (
            <li key={ch.id} className="border-b border-line">
              <button
                type="button"
                onClick={() => go({ c, s: 0, f: 0 })}
                className="flex w-full items-baseline gap-4 py-4 text-left hover:text-accent"
              >
                <span className="w-6 shrink-0 font-serif text-lg text-muted">{i + 1}</span>
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
            <h2 className="font-serif text-xl font-semibold">Sources</h2>
            <Links links={source.links} />
          </section>
        )}
      </div>
    </main>
  )
}
