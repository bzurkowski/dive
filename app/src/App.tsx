import { useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { askContext, askPrompt, askTargets, focusText } from './ask'
import { Inline } from './Inline'
import { CodeView, type CodeLink } from './code/CodeView'
import { DiagramView } from './diagrams/DiagramView'
import { actorLabel } from './diagrams/lanes'
import { SequenceView } from './diagrams/SequenceView'
import { Cover, End } from './shell/Cover'
import { Guard } from './shell/Guard'
import {
  flatIndex,
  flatten,
  flowAt,
  flows,
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
        const actor = (id: string) => actorLabel(st.actors, id)
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
  const [railOpen, setRailOpen] = useState(true)
  const [agent, setAgent] = useState('Claude Code')
  const [picks, setPicks] = useState<Picks>({}) // for this visit only, like the agent

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
    if (open || (e.key === ' ' && t.closest('button, a, summary'))) return
    // On a page step, Space scrolls the page while it has more that way, then moves.
    const kind = dive.chapters[pos.c]?.steps[pos.s]?.kind
    const page = e.key === ' ' && ['card', 'terms', 'quiz'].includes(kind)
    const box = page && document.getElementById('step')?.firstElementChild
    if (box && (e.shiftKey ? box.scrollTop : box.scrollHeight - box.clientHeight - box.scrollTop) > 1) {
      e.preventDefault()
      return box.scrollBy({ top: (e.shiftKey ? -0.9 : 0.9) * box.clientHeight })
    }
    if (e.key === 'a') {
      e.preventDefault() // else the a lands in the question box that opening focuses
      return document.getElementById('ask')?.togglePopover()
    }
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
  // a live region only announces changes, not its own mount. Only changed text is read, so a step
  // change reads the step title and the focused note or message, and a focus change only the latter.
  const frame = (screen: ReactNode) => (
    <>
      <div className="sr-only" aria-live="polite">
        <p>{step && `${chapter.title}: ${step.title}`}</p>
        <p>{step && focusText(step, pos.f, askContext(dive, pos, location.href))}</p>
      </div>
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
        {pos.c === END.c ? <End dive={dive} picks={picks} go={go} /> : <Cover dive={dive} go={go} />}
        <ThemeButton className="fixed top-3 right-4" />
      </>,
    )

  const size = stepSize(step)
  const last = pos.f === size - 1
  const next = move(dive, flat, pos, 1)

  const edge = step.kind === 'edge'
  const flow = flowAt(flows(chapter.steps), pos.s)
  const skip = skipFlow(dive, flat, pos)
  const skipTo =
    skip &&
    (skip.c === pos.c
      ? `next flow: ${chapter.steps[skip.s].title}`
      : skip.c === END.c
        ? 'the end'
        : dive.chapters[skip.c].title)

  const toEdge = last && !edge && chapter.steps[pos.s + 1]?.kind === 'edge'
  const toFlow = last && flow && next.c === pos.c && chapter.steps[next.s].kind === 'flow'
  const nextLabel =
    next.c === END.c
      ? 'Finish'
      : toEdge
        ? 'Next: edge cases'
        : next.c !== pos.c
          ? `Next chapter: ${dive.chapters[next.c].title}`
          : toFlow
            ? `Next flow: ${chapter.steps[next.s].title}`
            : 'Next'

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
          {/* Below 640px the position drops the chapter name and the dive title; the drawer has both. */}
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

        <main id="step" tabIndex={-1} className="min-h-0 flex-1 focus-visible:outline-none!" key={`${pos.c}-${pos.s}`}>
          <Guard at={pos.f}>
            <StepView
              dive={dive}
              step={step}
              focus={pos.f}
              onFocus={(f) => go({ ...pos, f })}
              onJump={jump}
              links={back}
              onLink={(k) => back && go(back[k].pos)}
              picked={picks[`${pos.c}/${pos.s}`]}
              onPick={(k) => setPicks({ ...picks, [`${pos.c}/${pos.s}`]: k })}
            />
          </Guard>
        </main>

        {/* Equal side columns hold the counter at the center, and Ask beside Previous, whatever Skip and Next say.
            The right column may shrink to nothing, so a tight footer squeezes Next before it moves the counter. */}
        <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-line bg-surface px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={btn}
              onClick={() => go(move(dive, flat, pos, -1))}
              aria-keyshortcuts="ArrowLeft"
            >
              Previous
            </button>
            <Ask dive={dive} pos={pos} agent={agent} setAgent={setAgent} />
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
            {/* Below 640px the label shortens so the footer stays one line; the name keeps the destination. */}
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

      <Drawer
        ref={chapters}
        aria-label="Chapters"
        head={<h2 className="text-2xl font-bold tracking-tight">Chapters</h2>}
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
      className={`fixed inset-y-0 m-0 h-full max-h-none max-w-none overflow-y-auto text-fg ${className}`}
    >
      <div className="min-h-full p-6">
        <div className="mb-6 flex items-center justify-between">
          {head}
          <form method="dialog">
            <button className={quiet}>Close</button>
          </form>
        </div>
        {children}
      </div>
    </dialog>
  )
}

// The prompt follows the step and focus. The link of the agent only prefills its prompt box.
// The agent picked is App state: remembered for this visit only.
function Ask({ dive, pos, agent, setAgent }: { dive: Dive; pos: Pos; agent: string; setAgent: (a: string) => void }) {
  const [question, setQuestion] = useState('')
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('')
  const panel = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const open = useRef<HTMLAnchorElement>(null)
  const timer = useRef(0)
  const ctx = askContext(dive, pos, location.href)
  const prompt = askPrompt(ctx, question)
  const targets = askTargets(ctx, prompt)
  const target = targets.find((t) => t.label === agent) ?? targets[0]
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(''), 1500)
  }
  const square = 'grid size-8 shrink-0 place-items-center rounded-md'
  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget="ask"
        title="Ask your agent about this step (A)"
        aria-keyshortcuts="a"
        className={`${btn} flex shrink-0 items-center gap-2`}
      >
        <Icon d={target.icon} />
        <span>
          Ask<span className="max-sm:hidden"> your agent</span>
        </span>
      </button>
      <div
        ref={panel}
        id="ask"
        popover="auto"
        role="dialog"
        aria-label="Ask your agent"
        // Opens over its button, kept 1rem inside the screen.
        onBeforeToggle={(e) =>
          e.newState === 'open' &&
          e.currentTarget.style.setProperty('--x', `${trigger.current?.getBoundingClientRect().left ?? 16}px`)
        }
        onToggle={(e) => e.newState === 'open' && box.current?.focus()}
        className="inset-auto bottom-18 left-[max(1rem,min(var(--x),calc(100vw-25rem)))] m-0 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 text-fg shadow-lg"
      >
        <h2 className="font-bold">Ask your agent about this step</h2>
        {/* A chat composer: the question, then the agent on the left and the actions on the right. */}
        <div className="mt-3 rounded-lg border border-line bg-bg outline-offset-2 outline-accent has-[textarea:focus-visible]:outline-2">
          <textarea
            ref={box}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
              e.preventDefault() // Enter opens once there is a question, Shift+Enter adds a line
              if (question.trim()) open.current?.click()
            }}
            rows={3}
            aria-label="Your question (optional)"
            placeholder="Your question (optional)"
            className="block w-full resize-none bg-transparent px-3 pt-2 text-base placeholder:text-muted focus-visible:outline-none!"
          />
          <div className="flex items-center gap-2 p-2">
            <label className="relative mr-auto flex items-center">
              <span className="sr-only">Agent</span>
              <Icon d={target.icon} className="pointer-events-none absolute left-2.5" />
              <select
                value={target.label}
                onChange={(e) => setAgent(e.target.value)}
                className="h-8 rounded-md border border-line bg-surface pr-1 pl-8 text-sm font-medium hover:border-accent"
              >
                {targets.map((t) => (
                  <option key={t.label}>{t.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={copy}
              title="Copy prompt"
              aria-label="Copy prompt"
              className={`${square} border border-line bg-surface hover:border-accent`}
            >
              <Icon d={copied === 'ok' ? CHECK : COPY} />
            </button>
            <a
              ref={open}
              href={target.href}
              title={`Open in ${target.label} (Enter)`}
              aria-label={`Open in ${target.label}`}
              onClick={() => panel.current?.hidePopover()}
              className={`${square} bg-accent text-bg hover:opacity-85`}
            >
              <Icon d={PLAY} />
            </a>
          </div>
        </div>
        <p role="status" className="mt-2 text-xs text-muted">
          {copied === 'ok'
            ? 'Copied the prompt.'
            : copied === 'fail'
              ? 'Could not copy: the browser blocked the clipboard.'
              : ctx.cwd
                ? 'The prompt is filled in, not sent: you continue in your agent.'
                : 'No agent here? Copy the prompt into any chat.'}
        </p>
      </div>
    </>
  )
}

// Footer buttons: a hairline outline, and solid ink for Next, the footer's one main action.
// Header and drawer actions are quiet: muted text that turns ink on hover.
const btn = 'rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:border-accent'
const fill = 'rounded-lg border border-accent bg-accent px-4 py-2 font-medium text-bg hover:opacity-85'
const quiet = 'rounded px-2 py-1 text-sm font-medium text-muted hover:text-fg'

const COPY =
  'M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11z'
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const PLAY = 'M8 5v14l11-7z'

const Icon = ({ d, className = '' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={`size-4 shrink-0 fill-current ${className}`}>
    <path d={d} />
  </svg>
)

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
}: {
  dive: Dive
  step: Step
  focus: number
  onFocus: (f: number) => void
  onJump: (id: string) => void
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
    <section className="h-full overflow-y-auto motion-safe:scroll-smooth">
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
