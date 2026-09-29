import { useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
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
  stepSize,
  toHash,
  COVER,
  END,
  type Pos,
} from './shell/nav'
import { Rail } from './shell/Rail'
import { searchTerms } from './shell/search'
import { ThemeButton } from './shell/Theme'
import { CardView, QuizView, TermList, TermsView } from './shell/Steps'
import type { Dive, Step, Term } from './types'

export default function App({ dive }: { dive: Dive }) {
  const flat = useMemo(() => flatten(dive), [dive])
  const terms = useMemo(() => {
    const seen = new Map<string, Term>()
    for (const ch of dive.chapters)
      for (const st of ch.steps) if (st.kind === 'terms') for (const t of st.terms) seen.set(t.term, t)
    return [...seen.values()]
  }, [dive])
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
  const search = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const chapters = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    document.title = dive.title
    // Back and forward fire popstate too, but every entry has its own hash.
    const sync = () => setPos(parseHash(dive, location.hash))
    addEventListener('hashchange', sync)
    return () => removeEventListener('hashchange', sync)
  }, [dive])

  const go = (p: Pos) => {
    const hash = toHash(p)
    if (hash !== location.hash) history[p.c === pos.c && p.s === pos.s ? 'replaceState' : 'pushState'](null, '', hash)
    chapters.current?.close()
    setPos(p)
  }

  const jump = (id: string) => {
    const t = flat.find(({ c, s }) => {
      const st = dive.chapters[c].steps[s]
      return 'id' in st && st.id === id
    })
    if (t) go({ ...t, f: 0 })
  }

  const toggleGlossary = () => {
    if (glossary.current?.open) return glossary.current.close()
    glossary.current?.showModal()
    search.current?.focus()
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const t = e.target as Element
    if (t.closest('input, textarea, select, [contenteditable]')) return
    const open = document.querySelector('dialog[open]')
    if (e.key === 'g' && (!open || open === glossary.current)) {
      e.preventDefault() // else the g lands in the search box that opening focuses
      return toggleGlossary()
    }
    if (open || (e.key === ' ' && t.closest('button, a'))) return
    const fwd = ['ArrowRight', 'j'].includes(e.key) || (e.key === ' ' && !e.shiftKey)
    const back = ['ArrowLeft', 'k'].includes(e.key) || (e.key === ' ' && e.shiftKey)
    if (!fwd && !back) return
    e.preventDefault()
    go(move(dive, flat, pos, fwd ? 1 : -1))
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const chapter = dive.chapters[pos.c]
  const step = chapter?.steps[pos.s]
  const found = searchTerms(terms, query)
  // One tree on every screen, so the live region and the glossary outlive the cover and end screens:
  // a live region only announces changes, not its own mount.
  const frame = (screen: ReactNode) => (
    <>
      <p className="sr-only" aria-live="polite">
        {step && `${chapter.title}: ${step.title}`}
      </p>
      {screen}
      <Drawer
        ref={glossary}
        aria-label="Glossary"
        onClose={() => setQuery('')}
        head={<h2 className="text-2xl font-bold tracking-tight">Glossary</h2>}
        className="right-0 left-auto w-[min(30rem,100%)] border-l border-line bg-bg"
      >
        {terms.length ? (
          <>
            <input
              ref={search}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search terms"
              placeholder="Search terms"
              className="mb-2 w-full rounded-lg border border-line bg-surface px-3 py-2 placeholder:text-muted"
            />
            {found.length ? <TermList terms={found} narrow /> : <p className="py-4 text-muted">No terms match.</p>}
          </>
        ) : (
          <p className="text-muted">This dive has no glossary.</p>
        )}
      </Drawer>
    </>
  )
  if (!step)
    return frame(
      <>
        {pos.c === END.c ? <End dive={dive} go={go} /> : <Cover dive={dive} go={go} />}
        <ThemeButton className="fixed top-3 right-4" />
      </>,
    )

  const size = stepSize(step)
  const last = pos.f === size - 1
  const next = move(dive, flat, pos, 1)

  const edge = step.kind === 'edge'
  const flow = flowAt(flows(chapter.steps), pos.s)
  const skip = skipEdges(dive, flat, pos)
  const skipTo =
    skip &&
    (skip.c === pos.c
      ? `next flow: ${chapter.steps[skip.s].title}`
      : skip.c === END.c
        ? 'the end'
        : dive.chapters[skip.c].title)

  const back = step.kind === 'code' && step.id ? backLinks.get(step.id) : undefined
  const rail = <Rail dive={dive} pos={pos} go={go} />
  const btn = 'rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:border-accent'

  return frame(
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
            onClick={toggleGlossary}
            aria-keyshortcuts="g"
            className="ml-auto shrink-0 rounded px-2 py-1 text-sm font-medium hover:text-accent"
          >
            Glossary
          </button>
          <ThemeButton />
          <div className="absolute inset-x-0 -bottom-px h-0.5 bg-line" aria-hidden>
            <div
              className="h-full bg-accent motion-safe:transition-[width]"
              style={{ width: `${((flatIndex(flat, pos) + 1) / flat.length) * 100}%` }}
            />
          </div>
        </header>

        <main className="min-h-0 flex-1" key={`${pos.c}-${pos.s}`}>
          <Guard>
            <StepView
              dive={dive}
              step={step}
              crumb={
                flow && (
                  <p className="mb-1 truncate text-sm text-muted">
                    {[chapter.title, pos.s > flow.s && chapter.steps[flow.s].title, edge && 'Edge cases']
                      .filter(Boolean)
                      .join(' › ')}
                  </p>
                )
              }
              focus={pos.f}
              onFocus={(f) => go({ ...pos, f })}
              onJump={jump}
              links={back}
              onLink={(k) => back && go(back[k].pos)}
            />
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
          <button type="button" className={btn} onClick={() => go(next)} aria-keyshortcuts="ArrowRight">
            {next.c === END.c
              ? 'Finish'
              : skip && !edge && last
                ? 'Next: edge cases (optional)'
                : next.c !== pos.c
                  ? `Next chapter: ${dive.chapters[next.c].title}`
                  : 'Next'}
          </button>
        </footer>
      </div>

      <Drawer
        ref={chapters}
        aria-label="Chapters"
        head={
          <button
            type="button"
            onClick={() => go(COVER)}
            className="rounded text-left text-lg font-bold tracking-tight"
          >
            {dive.title}
          </button>
        }
        className="left-0 w-[min(22rem,90%)] bg-surface"
      >
        {rail}
      </Drawer>
    </div>,
  )
}

// A modal side panel. Its content fills it, so a click on the dialog itself is a
// backdrop click, unless it ends a text selection dragged out of the panel.
function Drawer({ head, className, children, ...props }: ComponentProps<'dialog'> & { head: ReactNode }) {
  return (
    <dialog
      {...props}
      onClick={(e) => e.target === e.currentTarget && getSelection()?.isCollapsed && e.currentTarget.close()}
      className={`fixed inset-y-0 m-0 h-full max-h-none overflow-y-auto text-fg ${className}`}
    >
      <div className="min-h-full p-6">
        <div className="mb-6 flex items-center justify-between">
          {head}
          <form method="dialog">
            <button className="rounded px-2 py-1 text-muted hover:text-fg">Close</button>
          </form>
        </div>
        {children}
      </div>
    </dialog>
  )
}

function StepView({
  dive,
  step,
  crumb,
  focus,
  onFocus,
  onJump,
  links,
  onLink,
}: {
  dive: Dive
  step: Step
  crumb: ReactNode
  focus: number
  onFocus: (f: number) => void
  onJump: (id: string) => void
  links?: CodeLink[]
  onLink: (i: number) => void
}) {
  const visual = (say: string, view: ReactNode) => (
    <section className="flex h-full min-h-0 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6">
      <div className="max-w-5xl">
        {crumb}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">{step.title}</h1>
          {step.kind === 'edge' && (
            <span className="rounded-full border border-edge/50 bg-edge/10 px-2.5 py-0.5 text-sm font-medium text-edge">
              Edge case · optional
            </span>
          )}
        </div>
        <p className="mt-1 text-[17px] leading-snug">
          <Inline text={say} />
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">{view}</div>
    </section>
  )
  const page = (view: ReactNode, wide = false) => (
    <section className="h-full overflow-y-auto">
      <div className={`mx-auto px-6 py-12 sm:py-16 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
        {crumb}
        {view}
      </div>
    </section>
  )
  switch (step.kind) {
    case 'code': {
      const { repo, head } = dive.source
      return visual(
        step.say,
        <CodeView
          step={step}
          files={dive.files}
          focus={focus}
          onFocus={onFocus}
          blob={repo && head ? `https://github.com/${repo}/blob/${head}/` : undefined}
          links={links}
          onLink={onLink}
        />,
      )
    }
    case 'sequence':
    case 'flow':
    case 'edge':
      return visual(step.say, <SequenceView step={step} focus={focus} onFocus={onFocus} onJump={onJump} />)
    case 'diagram':
      return visual(step.say, <DiagramView step={step} focus={focus} onFocus={onFocus} />)
    case 'card':
      return page(<CardView step={step} />)
    case 'terms':
      return page(<TermsView step={step} />, true)
    case 'quiz':
      return page(<QuizView step={step} />)
  }
}
