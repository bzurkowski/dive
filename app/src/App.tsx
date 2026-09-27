import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Inline } from './Inline'
import { CodeView } from './code/CodeView'
import { DiagramView } from './diagrams/DiagramView'
import { SequenceView } from './diagrams/SequenceView'
import { Cover } from './shell/Cover'
import { Guard } from './shell/Guard'
import { flatIndex, flatten, move, parseHash, toHash, COVER, type Pos } from './shell/nav'
import { Rail } from './shell/Rail'
import { CardView, Notice, QuizView, TermList, TermsView } from './shell/Steps'
import { stepSize, type Dive, type Step, type Term } from './types'

const VISUAL = new Set(['code', 'sequence', 'diagram'])

export default function App({ dive }: { dive: Dive }) {
  const flat = useMemo(() => flatten(dive), [dive])
  const terms = useMemo(() => {
    const seen = new Map<string, Term>()
    for (const ch of dive.chapters)
      for (const st of ch.steps) if (st.kind === 'terms') for (const t of st.terms) seen.set(t.term, t)
    return [...seen.values()]
  }, [dive])
  const [pos, setPos] = useState(() => parseHash(dive, location.hash))
  const glossary = useRef<HTMLDialogElement>(null)
  const chapters = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    document.title = dive.title
    const sync = () => setPos(parseHash(dive, location.hash))
    addEventListener('popstate', sync)
    addEventListener('hashchange', sync)
    return () => {
      removeEventListener('popstate', sync)
      removeEventListener('hashchange', sync)
    }
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
          <h2 className="font-serif text-2xl font-semibold">Glossary</h2>
          <button type="button" onClick={() => glossary.current?.close()} className="rounded px-2 py-1 text-muted hover:text-fg">
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
        <Cover dive={dive} go={go} />
        {glossaryDialog}
      </>
    )

  const i = flatIndex(flat, pos)
  const size = stepSize(step)
  const atEnd = i === flat.length - 1 && pos.f === size - 1
  const nextChapter = pos.s === chapter.steps.length - 1 && pos.f === size - 1 ? dive.chapters[flat[i + 1]?.c]?.title : undefined
  const rail = <Rail dive={dive} pos={pos} go={go} />
  const btn = 'rounded-lg border border-line bg-surface px-4 py-2 font-medium hover:border-accent disabled:opacity-40 disabled:hover:border-line'

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface px-5 py-6 lg:flex">
        <button type="button" onClick={() => go(COVER)} className="mb-8 rounded text-left font-serif text-lg leading-snug font-semibold hover:text-accent">
          {dive.title}
        </button>
        <nav aria-label="Chapters">{rail}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
          <button type="button" onClick={() => chapters.current?.showModal()} className="rounded px-2 py-1 text-sm font-medium lg:hidden">
            Chapters
          </button>
          <button type="button" onClick={() => go(COVER)} className="min-w-0 truncate rounded text-left text-sm text-muted hover:text-fg lg:hidden">
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
          <div className="absolute inset-x-0 -bottom-px h-0.5 bg-line" aria-hidden>
            <div className="h-full bg-accent motion-safe:transition-[width]" style={{ width: `${((i + 1) / flat.length) * 100}%` }} />
          </div>
        </header>

        <main className="min-h-0 flex-1" key={`${pos.c}-${pos.s}`}>
          <p className="sr-only" aria-live="polite">
            {chapter.title}: {step.title}
          </p>
          <Guard>
            {VISUAL.has(step.kind) ? (
              <section className="flex h-full min-h-0 flex-col gap-3 px-4 pt-4 pb-3 sm:px-6">
                <div className="max-w-5xl">
                  <h2 className="font-serif text-2xl leading-tight font-semibold">{step.title}</h2>
                  {'say' in step && <p className="mt-1 text-[17px] leading-snug"><Inline text={step.say} /></p>}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">
                  <StepView dive={dive} step={step} focus={pos.f} onFocus={(f) => go({ ...pos, f })} />
                </div>
              </section>
            ) : (
              <section className="h-full overflow-y-auto">
                <div className={`mx-auto px-6 py-12 sm:py-16 ${step.kind === 'terms' ? 'max-w-4xl' : 'max-w-2xl'}`}>
                  <StepView dive={dive} step={step} focus={pos.f} onFocus={(f) => go({ ...pos, f })} />
                </div>
              </section>
            )}
          </Guard>
        </main>

        <footer className="flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5">
          <button type="button" className={btn} onClick={() => go(move(dive, flat, pos, -1))} aria-keyshortcuts="ArrowLeft">
            Previous
          </button>
          <p className="min-w-0 grow truncate text-center text-sm text-muted">
            {size > 1 && `${pos.f + 1} of ${size}`}
          </p>
          <button type="button" className={btn} disabled={atEnd} onClick={() => go(move(dive, flat, pos, 1))} aria-keyshortcuts="ArrowRight">
            {atEnd ? 'End of dive' : nextChapter ? `Next chapter: ${nextChapter}` : 'Next'}
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
            <button type="button" onClick={() => go(COVER)} className="rounded text-left font-serif text-lg font-semibold">
              {dive.title}
            </button>
            <button type="button" onClick={() => chapters.current?.close()} className="rounded px-2 py-1 text-muted hover:text-fg">
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

function StepView({ dive, step, focus, onFocus }: { dive: Dive; step: Step; focus: number; onFocus: (f: number) => void }) {
  const { repo, head } = dive.source
  switch (step.kind) {
    case 'code': {
      const file = dive.files?.[step.file]
      if (!file) return <Notice>The file {step.file} is missing from this dive.</Notice>
      const href = repo && head ? `https://github.com/${repo}/blob/${head}/${step.file}` : undefined
      return <CodeView step={step} file={file} focus={focus} onFocus={onFocus} href={href} />
    }
    case 'sequence':
      return <SequenceView step={step} focus={focus} onFocus={onFocus} />
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
