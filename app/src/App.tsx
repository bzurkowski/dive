import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Inline } from './Inline'
import { CodeView, type CodeLink } from './code/CodeView'
import { DiagramView } from './diagrams/DiagramView'
import { SequenceView } from './diagrams/SequenceView'
import { Cover, End } from './shell/Cover'
import { Guard } from './shell/Guard'
import {
  flatIndex,
  flatten,
  flowAt,
  flows,
  move,
  parseHash,
  skipEdges,
  toHash,
  COVER,
  END,
  type Pos,
} from './shell/nav'
import { Rail } from './shell/Rail'
import { ThemeButton } from './shell/Theme'
import { CardView, Notice, QuizView, TermList, TermsView } from './shell/Steps'
import { stepSize, type Dive, type Step, type Term } from './types'

const VISUAL = new Set(['code', 'sequence', 'flow', 'edge', 'diagram'])

export default function App({ dive }: { dive: Dive }) {
  const flat = useMemo(() => flatten(dive), [dive])
  const terms = useMemo(() => {
    const seen = new Map<string, Term>()
    for (const ch of dive.chapters)
      for (const st of ch.steps) if (st.kind === 'terms') for (const t of st.terms) seen.set(t.term, t)
    return [...seen.values()]
  }, [dive])
  // Code step id → the messages of its flow step that show it.
  const backLinks = useMemo(() => {
    const m = new Map<string, (CodeLink & { pos: Pos })[]>()
    dive.chapters.forEach((ch, c) =>
      ch.steps.forEach((st, s) => {
        if (st.kind !== 'flow') return
        const actor = (id: string) => st.actors.find((a) => a.id === id)?.label ?? id
        st.messages.forEach((msg, f) => {
          if (!msg.step) return
          const link = { from: actor(msg.from), to: actor(msg.to), label: msg.label, pos: { c, s, f } }
          m.set(msg.step, [...(m.get(msg.step) ?? []), link])
        })
      }),
    )
    return m
  }, [dive])
  const [pos, setPos] = useState(() => parseHash(dive, location.hash))
  const glossary = useRef<HTMLDialogElement>(null)
  const chapters = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    document.title = dive.title
    // Back and forward fire popstate too, but every entry has its own hash.
    const sync = () => setPos(parseHash(dive, location.hash))
    addEventListener('hashchange', sync)
    return () => removeEventListener('hashchange', sync)
  }, [dive])

  // Focus moves replace the history entry; step and chapter moves push one.
  const go = useCallback(
    (p: Pos) => {
      const hash = toHash(p)
      if (hash !== location.hash) history[p.c === pos.c && p.s === pos.s ? 'replaceState' : 'pushState'](null, '', hash)
      chapters.current?.close()
      setPos(p)
    },
    [pos],
  )

  // Open the step with this id (Message.step).
  const jump = (id: string) => {
    const t = flat.find(({ c, s }) => {
      const st = dive.chapters[c].steps[s]
      return 'id' in st && st.id === id
    })
    if (t) go({ ...t, f: 0 })
  }

  const toggle = (d: HTMLDialogElement | null) => (d?.open ? d.close() : d?.showModal())
  // Content fills the dialog, so a click that hits the dialog itself is a backdrop click.
  const closeOnBackdrop = (e: MouseEvent<HTMLDialogElement>) => e.target === e.currentTarget && e.currentTarget.close()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'g') return toggle(glossary.current)
      if (document.querySelector('dialog[open]')) return
      if (e.key === ' ' && t.closest('button, a')) return
      const fwd = ['ArrowRight', 'j'].includes(e.key) || (e.key === ' ' && !e.shiftKey)
      const back = ['ArrowLeft', 'k'].includes(e.key) || (e.key === ' ' && e.shiftKey)
      if (!fwd && !back) return
      e.preventDefault()
      go(move(dive, flat, pos, fwd ? 1 : -1))
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [dive, flat, pos, go])

  const glossaryDialog = (
    <dialog
      ref={glossary}
      aria-label="Glossary"
      onClick={closeOnBackdrop}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(30rem,100%)] overflow-y-auto border-l border-line bg-bg text-fg"
    >
      <div className="min-h-full p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Glossary</h2>
          <button
            type="button"
            onClick={() => glossary.current?.close()}
            className="rounded px-2 py-1 text-muted hover:text-fg"
          >
            Close
          </button>
        </div>
        {terms.length ? <TermList terms={terms} narrow /> : <p className="text-muted">This dive has no glossary.</p>}
      </div>
    </dialog>
  )

  const chapter = dive.chapters[pos.c]
  const step = chapter?.steps[pos.s]
  if (!step)
    return (
      <>
        {pos.c === END.c ? <End dive={dive} go={go} /> : <Cover dive={dive} go={go} />}
        <ThemeButton className="fixed top-3 right-4" />
        {glossaryDialog}
      </>
    )

  const i = flatIndex(flat, pos)
  const size = stepSize(step)
  const last = pos.f === size - 1
  const atEnd = i === flat.length - 1 && last
  const nextChapter = pos.s === chapter.steps.length - 1 && last ? dive.chapters[flat[i + 1]?.c]?.title : undefined

  // Flows: a breadcrumb inside a flow, and a way to skip edge cases.
  const fl = flows(chapter.steps)
  const flow = flowAt(fl, pos.s)
  const edge = step.kind === 'edge'
  const crumbs = flow
    ? [chapter.title, ...(pos.s > flow.s ? [chapter.steps[flow.s].title] : []), ...(edge ? ['Edge cases'] : [])]
    : []
  const crumb = crumbs.length > 0 && <p className="mb-1 truncate text-sm text-muted">{crumbs.join(' › ')}</p>
  const skip = skipEdges(dive, flat, pos)
  const skipTo =
    skip &&
    (skip.c === pos.c
      ? `next flow: ${chapter.steps[skip.s].title}`
      : skip.c === END.c
        ? 'the end'
        : dive.chapters[skip.c].title)

  const back = step.kind === 'code' && step.id ? backLinks.get(step.id) : undefined
  const view = (
    <StepView
      dive={dive}
      step={step}
      focus={pos.f}
      onFocus={(f) => go({ ...pos, f })}
      onJump={jump}
      links={back}
      onLink={(k) => back && go(back[k].pos)}
    />
  )
  const rail = <Rail dive={dive} pos={pos} go={go} />
  const btn = 'rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:border-accent'

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-5 py-6 lg:flex">
        <button
          type="button"
          onClick={() => go(COVER)}
          className="mb-8 rounded text-left text-lg leading-snug font-bold tracking-tight hover:text-accent"
        >
          {dive.title}
        </button>
        <nav aria-label="Chapters">{rail}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
          <button
            type="button"
            onClick={() => chapters.current?.showModal()}
            className="rounded px-2 py-1 text-sm font-medium lg:hidden"
          >
            Chapters
          </button>
          <button
            type="button"
            onClick={() => go(COVER)}
            className="min-w-0 truncate rounded text-left text-sm text-muted hover:text-fg lg:hidden"
          >
            {dive.title}
          </button>
          <p className="hidden min-w-0 truncate text-sm text-muted lg:block">
            {chapter.title}, step {pos.s + 1} of {chapter.steps.length}
          </p>
          <button
            type="button"
            onClick={() => toggle(glossary.current)}
            aria-keyshortcuts="g"
            className="ml-auto shrink-0 rounded px-2 py-1 text-sm font-medium hover:text-accent"
          >
            Glossary
          </button>
          <ThemeButton />
          <div className="absolute inset-x-0 -bottom-px h-0.5 bg-line" aria-hidden>
            <div
              className="h-full bg-accent motion-safe:transition-[width]"
              style={{ width: `${((i + 1) / flat.length) * 100}%` }}
            />
          </div>
        </header>

        {/* Outside the keyed main: a live region only announces changes, not its own mount. */}
        <p className="sr-only" aria-live="polite">{`${chapter.title}: ${step.title}`}</p>
        <main className="min-h-0 flex-1" key={`${pos.c}-${pos.s}`}>
          <Guard>
            {VISUAL.has(step.kind) ? (
              <section className="flex h-full min-h-0 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6">
                <div className="max-w-5xl">
                  {crumb}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-2xl leading-tight font-bold tracking-tight">{step.title}</h2>
                    {edge && (
                      <span className="rounded-full border border-edge/50 bg-edge/10 px-2.5 py-0.5 text-sm font-medium text-edge">
                        Edge case · optional
                      </span>
                    )}
                  </div>
                  {'say' in step && step.say && (
                    <p className="mt-1 text-[17px] leading-snug">
                      <Inline text={step.say} />
                    </p>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">{view}</div>
              </section>
            ) : (
              <section className="h-full overflow-y-auto">
                <div className={`mx-auto px-6 py-12 sm:py-16 ${step.kind === 'terms' ? 'max-w-4xl' : 'max-w-2xl'}`}>
                  {crumb}
                  {view}
                </div>
              </section>
            )}
          </Guard>
        </main>

        <footer className="flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5">
          <button
            type="button"
            className={btn}
            onClick={() => go(move(dive, flat, pos, -1))}
            aria-keyshortcuts="ArrowLeft"
          >
            Previous
          </button>
          <p className="min-w-0 grow truncate text-center text-sm text-muted">
            {size > 1 && `${pos.f + 1} of ${size}`}
          </p>
          {skip && (
            <button
              type="button"
              title={`Skip to ${skipTo}`}
              onClick={() => go(skip)}
              className="min-w-0 truncate rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg"
            >
              Skip to {skipTo}
            </button>
          )}
          <button
            type="button"
            className={btn}
            onClick={() => go(move(dive, flat, pos, 1))}
            aria-keyshortcuts="ArrowRight"
          >
            {atEnd
              ? 'Finish'
              : skip && !edge && last
                ? 'Next: edge cases (optional)'
                : nextChapter
                  ? `Next chapter: ${nextChapter}`
                  : 'Next'}
          </button>
        </footer>
      </div>

      <dialog
        ref={chapters}
        aria-label="Chapters"
        onClick={closeOnBackdrop}
        className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-[min(22rem,90%)] overflow-y-auto bg-surface text-fg"
      >
        <div className="min-h-full p-6">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(COVER)}
              className="rounded text-left text-lg font-bold tracking-tight"
            >
              {dive.title}
            </button>
            <button
              type="button"
              onClick={() => chapters.current?.close()}
              className="rounded px-2 py-1 text-muted hover:text-fg"
            >
              Close
            </button>
          </div>
          {rail}
        </div>
      </dialog>
      {glossaryDialog}
    </div>
  )
}

function StepView({
  dive,
  step,
  focus,
  onFocus,
  onJump,
  links,
  onLink,
}: {
  dive: Dive
  step: Step
  focus: number
  onFocus: (f: number) => void
  onJump: (id: string) => void
  links?: CodeLink[]
  onLink: (i: number) => void
}) {
  const { repo, head } = dive.source
  switch (step.kind) {
    case 'code': {
      const blob = repo && head ? `https://github.com/${repo}/blob/${head}/` : undefined
      return (
        <CodeView
          step={step}
          files={dive.files}
          focus={focus}
          onFocus={onFocus}
          blob={blob}
          links={links}
          onLink={onLink}
        />
      )
    }
    case 'sequence':
    case 'flow':
    case 'edge':
      return <SequenceView step={step} focus={focus} onFocus={onFocus} onJump={onJump} />
    case 'diagram':
      return <DiagramView step={step} focus={focus} onFocus={onFocus} />
    case 'card':
      return <CardView step={step} />
    case 'terms':
      return <TermsView step={step} />
    case 'quiz':
      return <QuizView step={step} />
    default:
      return <Notice>Unknown step type: {(step as { kind?: string }).kind ?? 'none'}.</Notice>
  }
}
