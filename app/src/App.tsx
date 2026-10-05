import { useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { askContext, focusText } from './ask'
import { Inline } from './Inline'
import { CodeView, type CodeLink } from './code/CodeView'
import { DiagramView } from './diagrams/DiagramView'
import { actorLabel } from './diagrams/lanes'
import { SequenceView } from './diagrams/SequenceView'
import { Ask } from './shell/Ask'
import { Cover, End } from './shell/Cover'
import { Guard } from './shell/Guard'
import {
  flatIndex,
  flatten,
  focusLabel,
  move,
  parseHash,
  skipFlow,
  stepSize,
  toHash,
  COVER,
  END,
  type Picks,
  type Pos,
  type StepViewProps,
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
    for (const { step } of flat) if (step.kind === 'terms') for (const t of step.terms) seen.set(t.term, t)
    return [...seen.values()]
  }, [flat])
  const backLinks = useMemo(() => {
    const m = new Map<string, (CodeLink & { pos: Pos })[]>()
    for (const { c, s, step } of flat) {
      if (step.kind !== 'flow') continue
      const actor = (id: string) => actorLabel(step.actors, id)
      step.messages.forEach((msg, f) => {
        if (!msg.step) return
        const link = { from: actor(msg.from), to: actor(msg.to), label: msg.label, pos: { c, s, f } }
        m.set(msg.step, [...(m.get(msg.step) ?? []), link])
      })
    }
    return m
  }, [flat])
  const [pos, setPos] = useState(() => parseHash(dive, location.hash))
  const glossary = useRef<HTMLDialogElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const chapters = useRef<HTMLDialogElement>(null)
  const [railOpen, setRailOpen] = useState(true)
  const [agent, setAgent] = useState('')
  const [picks, setPicks] = useState<Picks>({})

  useEffect(() => {
    document.title = dive.title
    // Back and forward also fire hashchange, since every history entry has its own hash.
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
    const t = flat.find(({ step }) => 'id' in step && step.id === id)
    if (t) go({ c: t.c, s: t.s, f: 0 })
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
    if (open || (e.key === ' ' && t.closest('button, a, summary'))) return
    const page = e.key === ' ' && document.getElementById('page')
    if (page && (e.shiftKey ? page.scrollTop : page.scrollHeight - page.clientHeight - page.scrollTop) > 1) {
      e.preventDefault()
      return page.scrollBy({ top: (e.shiftKey ? -0.9 : 0.9) * page.clientHeight })
    }
    if (e.key === 'a') {
      e.preventDefault()
      return document.getElementById('ask')?.togglePopover()
    }
    const fwd = ['ArrowRight', 'j'].includes(e.key) || (e.key === ' ' && !e.shiftKey)
    const back = ['ArrowLeft', 'k'].includes(e.key) || (e.key === ' ' && e.shiftKey)
    if (!fwd && !back) return
    e.preventDefault()
    go(move(dive, pos, fwd ? 1 : -1))
  })
  useEffect(() => {
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const chapter = dive.chapters[pos.c]
  const step = chapter?.steps[pos.s]
  const found = searchTerms(terms, query)
  // One tree on every screen: a live region announces changes, not its own mount.
  const frame = (screen: ReactNode) => (
    <>
      <div className="sr-only" aria-live="polite">
        <p>{step && `${chapter.title}: ${step.title}`}</p>
        <p>{step && focusText(step, pos.f, askContext(dive, pos, location.href))}</p>
      </div>
      {screen}
      <Drawer
        ref={glossary}
        label="Glossary"
        onClose={() => setQuery('')}
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
        {pos.c === END.c ? <End dive={dive} picks={picks} go={go} /> : <Cover dive={dive} go={go} />}
        <ThemeButton className="fixed top-3 right-4" />
      </>,
    )

  const next = move(dive, pos, 1)
  const after = pos.f === stepSize(step) - 1 ? chapter.steps[pos.s + 1]?.kind : undefined
  const toEdge = after === 'edge' && step.kind !== 'edge'
  const nextLabel =
    next.c === END.c
      ? 'Finish'
      : toEdge
        ? 'Next: edge cases'
        : next.c !== pos.c
          ? `Next chapter: ${dive.chapters[next.c].title}`
          : after === 'flow'
            ? `Next flow: ${chapter.steps[next.s].title}`
            : 'Next'

  const skip = skipFlow(dive, pos)
  const skipTo =
    skip &&
    (skip.c === pos.c
      ? `next flow: ${chapter.steps[skip.s].title}`
      : skip.c === END.c
        ? 'the end'
        : dive.chapters[skip.c].title)

  const at = `${pos.c}/${pos.s}`
  const back = step.kind === 'code' && step.id ? backLinks.get(step.id) : undefined
  const rail = <Rail dive={dive} pos={pos} go={go} />

  return frame(
    <div className="flex h-full">
      <button
        type="button"
        onClick={() => document.getElementById('step')?.focus()}
        className={`${btn} sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2`}
      >
        Skip to the step
      </button>
      <aside
        id="rail"
        className={`hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-5 pt-3.5 pb-6 ${railOpen ? 'lg:flex' : ''}`}
      >
        <nav aria-label="Chapters">{rail}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
          <button type="button" onClick={() => chapters.current?.showModal()} className={`${quiet} lg:hidden`}>
            Chapters
          </button>
          <button
            type="button"
            onClick={() => setRailOpen(!railOpen)}
            aria-controls="rail"
            aria-expanded={railOpen}
            aria-label="Chapters"
            title={`${railOpen ? 'Hide' : 'Show'} chapters`}
            className="hidden shrink-0 rounded p-1.5 text-muted hover:text-fg lg:block"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(COVER)}
            className={`min-w-0 truncate rounded text-left text-sm text-muted hover:text-fg max-sm:hidden ${railOpen ? 'lg:hidden' : ''}`}
          >
            {dive.title}
          </button>
          <p className="min-w-0 truncate text-sm text-muted">
            <span className="max-sm:hidden">{chapter.title}, step</span>
            <span className="sm:hidden">Step</span> {pos.s + 1} of {chapter.steps.length}
          </p>
          <button type="button" onClick={toggleGlossary} aria-keyshortcuts="g" className={`${quiet} ml-auto shrink-0`}>
            Glossary
          </button>
          <ThemeButton />
          <div className="absolute inset-x-0 -bottom-px h-0.5 bg-line" aria-hidden>
            <div
              className="h-full origin-left bg-accent motion-safe:transition-transform"
              style={{ transform: `scaleX(${(flatIndex(flat, pos) + 1) / flat.length})` }}
            />
          </div>
        </header>

        <main id="step" tabIndex={-1} className="min-h-0 flex-1 focus-visible:outline-none!" key={at}>
          <Guard at={pos.f}>
            <StepView
              dive={dive}
              step={step}
              focus={pos.f}
              onFocus={(f) => go({ ...pos, f })}
              onJump={jump}
              links={back}
              onLink={(k) => back && go(back[k].pos)}
              picked={picks[at]}
              onPick={(k) => setPicks((p) => ({ ...p, [at]: k }))}
            />
          </Guard>
        </main>

        {/* Equal side columns hold the counter at the center whatever Skip and Next say.
            The right column may shrink to nothing, so a tight footer squeezes Next before it moves the counter. */}
        <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line bg-surface px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button type="button" className={btn} onClick={() => go(move(dive, pos, -1))} aria-keyshortcuts="ArrowLeft">
              Previous
            </button>
            <Ask dive={dive} pos={pos} agent={agent} setAgent={setAgent} className={btn} />
          </div>
          <p className="text-sm whitespace-nowrap text-muted tabular-nums first-letter:uppercase max-sm:hidden">
            {focusLabel(step, pos.f)}
          </p>
          <div className="col-start-3 flex min-w-0 items-center justify-end gap-3">
            {skip && (
              <button
                type="button"
                title={`Skip to ${skipTo}`}
                onClick={() => go(skip)}
                className="min-w-0 truncate rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-fg max-sm:hidden"
              >
                Skip to {skipTo}
              </button>
            )}
            {/* The aria-label keeps the destination that the short label below 640px drops. */}
            <button
              type="button"
              className={`${fill} min-w-0 truncate max-sm:shrink-0`}
              onClick={() => go(next)}
              aria-label={nextLabel}
              title={nextLabel}
              aria-keyshortcuts="ArrowRight"
            >
              <span className="max-sm:hidden">{nextLabel}</span>
              <span className="sm:hidden">{toEdge ? 'Edge cases →' : next.c === END.c ? 'Finish' : 'Next'}</span>
            </button>
          </div>
        </footer>
      </div>

      <Drawer ref={chapters} label="Chapters" className="left-0 w-[min(22rem,90%)] bg-surface">
        {rail}
      </Drawer>
    </div>,
  )
}

// The content fills the panel, so a click on the dialog itself is a backdrop click,
// unless it ends a text selection dragged out of the panel.
function Drawer({ label, className, children, ...props }: ComponentProps<'dialog'> & { label: string }) {
  return (
    <dialog
      {...props}
      aria-label={label}
      onClick={(e) => e.target === e.currentTarget && getSelection()?.isCollapsed && e.currentTarget.close()}
      className={`fixed inset-y-0 m-0 h-full max-h-none max-w-none overflow-y-auto text-fg ${className}`}
    >
      <div className="min-h-full p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">{label}</h2>
          <form method="dialog">
            <button className={quiet}>Close</button>
          </form>
        </div>
        {children}
      </div>
    </dialog>
  )
}

const btn = 'rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:border-accent'
const fill = 'rounded-lg border border-accent bg-accent px-4 py-2 font-medium text-bg hover:opacity-85'
const quiet = 'rounded px-2 py-1 text-sm font-medium text-muted hover:text-fg'

function StepView({
  dive,
  step,
  focus,
  onFocus,
  onJump,
  links,
  onLink,
  picked,
  onPick,
}: StepViewProps<Step> & {
  dive: Dive
  links?: CodeLink[]
  onLink: (i: number) => void
  picked?: number
  onPick: (k: number) => void
}) {
  const visual = (say: string, view: ReactNode) => (
    <section className="flex h-full min-h-0 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6">
      <div className="max-w-5xl">
        <h1 className="text-2xl leading-tight font-bold tracking-tight">{step.title}</h1>
        <p className="mt-1 text-[17px] leading-snug">
          <Inline text={say} />
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">{view}</div>
    </section>
  )
  const page = (view: ReactNode, wide = false) => (
    <section id="page" className="h-full overflow-y-auto motion-safe:scroll-smooth">
      <div className={`mx-auto px-6 py-12 sm:py-16 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>{view}</div>
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
      return page(<QuizView step={step} picked={picked} onPick={onPick} />)
  }
}
