import { useEffect, useRef, type ReactNode } from 'react'
import { Inline } from '../Inline'
import type { CardStep, Link, QuizStep, Term, TermsStep } from '../types'

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="m-4 rounded-md border border-line bg-surface px-4 py-3 text-sm">
      {children}
    </div>
  )
}

// Paragraphs split on blank lines. "- " lines become bullets.
function Rich({ text }: { text: string }) {
  const blocks: { ul: boolean; lines: string[] }[] = []
  let block: (typeof blocks)[number] | undefined
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const ul = line.startsWith('- ')
    const item = ul ? line.slice(2) : line
    if (!line) block = undefined
    else if (block?.ul === ul) block.lines.push(item)
    else {
      block = { ul, lines: [item] }
      blocks.push(block)
    }
  }
  return blocks.map((b, i) =>
    b.ul ? (
      <ul key={i} className="my-4 list-disc space-y-2 pl-5 marker:text-accent">
        {b.lines.map((l, j) => (
          <li key={j}>
            <Inline text={l} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={i} className="my-4">
        <Inline text={b.lines.join(' ')} />
      </p>
    ),
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
      {children}
    </a>
  )
}

export function Links({ links }: { links: Link[] }) {
  return (
    <ul className="mt-3 space-y-1 text-base">
      {links.map((l, i) => (
        <li key={i}>
          <ExternalLink href={l.url}>{l.title}</ExternalLink>
        </li>
      ))}
    </ul>
  )
}

const heading = 'text-3xl leading-tight font-bold tracking-tight text-balance'

export function CardView({ step }: { step: CardStep }) {
  return (
    <article className="text-lg leading-relaxed">
      <h1 className={heading}>{step.title}</h1>
      <Rich text={step.body} />
      {!!step.links?.length && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-muted">Sources</h2>
          <Links links={step.links} />
        </section>
      )}
    </article>
  )
}

export function TermList({ terms, narrow }: { terms: Term[]; narrow?: boolean }) {
  return (
    <dl className={`grid gap-x-10 ${narrow ? '' : 'sm:grid-cols-2'}`}>
      {terms.map((t, i) => (
        <div key={i} className="border-t border-line py-4">
          <dt className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-xl font-bold tracking-tight">{t.term}</span>
            {t.code && <code className="font-mono text-sm text-muted">{t.code}</code>}
          </dt>
          <dd className="mt-1 text-base leading-relaxed">
            <Inline text={t.meaning} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function TermsView({ step }: { step: TermsStep }) {
  return (
    <article>
      <h1 className={heading}>{step.title}</h1>
      {step.say && (
        <p className="mt-2 text-lg leading-snug text-muted">
          <Inline text={step.say} />
        </p>
      )}
      <div className="mt-6">
        <TermList terms={step.terms} />
      </div>
    </article>
  )
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Shuffled once per quiz and kept, so a revisit shows the same order. Holds indexes into step.options.
const orders = new WeakMap<QuizStep, number[]>()
function order(step: QuizStep): number[] {
  let o = orders.get(step)
  if (!o) orders.set(step, (o = shuffle(step.options.map((_, k) => k))))
  return o
}

// The pick is an index into step.options and lives in App, so it survives a revisit.
export function QuizView({ step, picked, onPick }: { step: QuizStep; picked?: number; onPick: (k: number) => void }) {
  const done = picked !== undefined
  // A fresh pick brings the verdict under the options into view; a revisit doesn't scroll.
  const verdict = useRef<HTMLParagraphElement>(null)
  const restored = useRef(done)
  useEffect(() => {
    if (done && !restored.current) verdict.current?.scrollIntoView({ block: 'nearest' })
  }, [done])
  return (
    <article>
      <h1 className={heading}>
        <Inline text={step.question} />
      </h1>
      <p className="mt-2 text-muted">Pick one answer.</p>
      <ul className="mt-6 space-y-3">
        {order(step).map((k) => {
          const o = step.options[k]
          const tone = !done
            ? 'border-line hover:border-accent'
            : o.correct
              ? 'border-ok'
              : k === picked
                ? 'border-bad'
                : 'border-line opacity-70'
          return (
            <li key={k}>
              <button
                type="button"
                aria-disabled={done}
                aria-pressed={k === picked}
                onClick={() => !done && onPick(k)}
                className={`w-full rounded-lg border-2 bg-surface px-4 py-3 text-left text-lg leading-snug ${tone} ${done ? 'cursor-default' : ''}`}
              >
                <span className="flex items-start gap-3">
                  <span className="grow">
                    <Inline text={o.text} />
                  </span>
                  {done && (o.correct || k === picked) && (
                    <span className={`shrink-0 text-sm font-semibold ${o.correct ? 'text-ok' : 'text-bad'}`}>
                      {o.correct ? 'Correct' : 'Your pick'}
                    </span>
                  )}
                </span>
                {done && (
                  <span className="mt-2 block text-base text-muted">
                    <Inline text={o.why} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p ref={verdict} aria-live="polite" className="mt-5 text-lg font-semibold">
        {done &&
          (step.options[picked].correct ? (
            <span className="text-ok">Right.</span>
          ) : (
            <span className="text-bad">Not this one. The correct answer is marked.</span>
          ))}
      </p>
    </article>
  )
}
