import { Inline } from '../Inline'
import type { Dive } from '../types'
import { chapterSeconds, minutes, origin, quizTally, COVER, type Picks, type Pos } from './nav'
import { ExternalLink, Links } from './Steps'

const KIND = { pr: 'Pull request', module: 'Module', question: 'Question' }
// The border keeps primary and secondary the same height side by side.
const primary =
  'rounded-lg border border-accent bg-accent px-6 py-3 text-lg font-semibold text-surface hover:opacity-90'
const secondary = 'rounded-lg border border-line bg-surface px-6 py-3 text-lg font-medium hover:border-accent'
const focus = (el: HTMLElement | null) => el?.focus() // React's autoFocus skips links

export function Cover({ dive, go }: { dive: Dive; go: (p: Pos) => void }) {
  const total = chapterSeconds(dive.chapters.flatMap((ch) => ch.steps))
  const { source } = dive
  // "Pull request: sindresorhus/ky #842", or the question itself. Without a repo, origin() says "Pull request".
  const where = source.kind === 'question' ? source.ref : origin(source)
  const deep = dive.chapters.findIndex((ch) => ch.id === 'walkthrough')
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <p className="text-muted">
          {!where.startsWith(KIND[source.kind]) && `${KIND[source.kind]}: `}
          {source.url ? (
            <ExternalLink href={source.url}>{where}</ExternalLink>
          ) : (
            <span className="text-fg">{where}</span>
          )}
        </p>
        <h1 className="mt-4 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-[3.5rem]">
          {dive.title}
        </h1>
        <p className="mt-6 max-w-[62ch] text-xl leading-relaxed">
          <Inline text={dive.summary} />
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button type="button" autoFocus onClick={() => go({ c: 0, s: 0, f: 0 })} className={primary}>
            Start the dive
          </button>
          {deep > 0 && (
            <button
              type="button"
              title="Skip to the code walkthrough"
              onClick={() => go({ c: deep, s: 0, f: 0 })}
              className={secondary}
            >
              Jump to the code
            </button>
          )}
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
                className="group flex w-full items-baseline gap-4 py-4 text-left"
              >
                <span className="w-6 shrink-0 text-lg text-muted tabular-nums">{c + 1}</span>
                <span className="grow text-lg group-hover:underline">{ch.title}</span>
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

// The last page: what to check in the code, how the quizzes went, then the hand-off to the source.
export function End({ dive, picks, go }: { dive: Dive; picks: Picks; go: (p: Pos) => void }) {
  const { source } = dive
  const c = dive.chapters.findIndex((ch) => ch.id === 'review-focus')
  const tally = quizTally(dive, picks)
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="text-4xl leading-tight font-bold tracking-tight text-balance">You finished the dive</h1>
        <p className="mt-3 text-xl leading-relaxed text-muted">{dive.title}</p>
        {tally && <p className="mt-6 text-lg">{tally}.</p>}

        {c >= 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold tracking-tight">What to check</h2>
            <ol className="mt-4 border-t border-line">
              {dive.chapters[c].steps.map((st, s) => (
                <li key={s} className="border-b border-line">
                  <button
                    type="button"
                    onClick={() => go({ c, s, f: 0 })}
                    className="w-full py-4 text-left text-lg hover:underline"
                  >
                    {st.title}
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
          {source.url && (
            <a ref={focus} href={source.url} target="_blank" rel="noreferrer" className={primary}>
              Open the {KIND[source.kind].toLowerCase()} <span aria-hidden>↗</span>
            </a>
          )}
          <button
            type="button"
            autoFocus={!source.url}
            onClick={() => go(COVER)}
            className={source.url ? '-mx-2 rounded px-2 py-1 font-medium text-muted hover:text-fg' : primary}
          >
            Back to the start
          </button>
        </div>
        <p className="mt-6 text-sm text-muted">
          Press <kbd>←</kbd> to go back to the last step.
        </p>
      </div>
    </main>
  )
}
