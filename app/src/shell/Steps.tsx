import { useState, type ReactNode } from 'react'
import { Inline } from '../Inline'
import type { CardStep, Link, QuizStep, Term, TermsStep } from '../types'

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="m-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
      {children}
    </p>
  )
}

// Paragraphs split on blank lines; "- " lines become bullets.
function Rich({ text }: { text: string }) {
  const blocks: { ul: boolean; lines: string[] }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const ul = line.startsWith('- ')
    const last = blocks[blocks.length - 1]
    if (!line) blocks.push({ ul: false, lines: [] })
    else if (last && last.ul === ul && (ul || last.lines.length)) last.lines.push(ul ? line.slice(2) : line)
    else blocks.push({ ul, lines: [ul ? line.slice(2) : line] })
  }
  return blocks
    .filter((b) => b.lines.length)
    .map((b, i) =>
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

export function Links({ links }: { links?: Link[] }) {
  if (!links?.length) return null
  return (
    <ul className="mt-6 space-y-1 text-base">
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
            {l.title}
          </a>
        </li>
      ))}
    </ul>
  )
}

const heading = 'text-3xl leading-tight font-bold tracking-tight text-balance'

export function CardView({ step }: { step: CardStep }) {
  return (
    <article className="text-lg leading-relaxed">
      <h2 className={heading}>{step.title}</h2>
      <Rich text={step.body} />
      <Links links={step.links} />
    </article>
  )
}

export function TermList({ terms, narrow }: { terms: Term[]; narrow?: boolean }) {
  return (
    <dl className={`grid gap-x-10 ${narrow ? '' : 'sm:grid-cols-2'}`}>
      {terms.map((t) => (
        <div key={t.term} className="border-t border-line py-4">
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
      <h2 className={`${heading} mb-6`}>{step.title}</h2>
      <TermList terms={step.terms} />
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

export function QuizView({ step }: { step: QuizStep }) {
  const [options] = useState(() => shuffle(step.options))
  const [picked, setPicked] = useState<number | null>(null)
  const done = picked !== null
  return (
    <article>
      <h2 className={heading}>
        <Inline text={step.question} />
      </h2>
      <p className="mt-2 text-muted">Pick one answer.</p>
      <ul className="mt-6 space-y-3">
        {options.map((o, i) => {
          const tone = !done
            ? 'border-line hover:border-accent'
            : o.correct
              ? 'border-ok'
              : i === picked
                ? 'border-bad'
                : 'border-line opacity-70'
          return (
            <li key={i}>
              <button
                type="button"
                disabled={done}
                aria-pressed={i === picked}
                onClick={() => setPicked(i)}
                className={`w-full rounded-lg border-2 bg-surface px-4 py-3 text-left text-lg leading-snug ${tone} ${done ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className="flex items-start gap-3">
                  <span className="grow">
                    <Inline text={o.text} />
                  </span>
                  {done && (o.correct || i === picked) && (
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
      <p aria-live="polite" className="mt-5 text-lg font-semibold">
        {done &&
          (options[picked].correct ? (
            <span className="text-ok">Right.</span>
          ) : (
            <span className="text-bad">Not this one. The correct answer is marked.</span>
          ))}
      </p>
    </article>
  )
}
