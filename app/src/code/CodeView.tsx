import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Inline } from '../Inline'
import type { CodeNote, CodeStep, FileData, StepViewProps } from '../types'
import { highlightFile, type Tokens } from './highlight'
import { layout, noteSpan, parse, type Row } from './rows'

// A flow message that shows this step, resolved to actor labels.
export interface CodeLink {
  from: string
  to: string
  label: string
}

type Props = StepViewProps<CodeStep> & {
  files?: Record<string, FileData>
  blob?: string // GitHub blob URL prefix; the file path is appended
  links?: CodeLink[] // shown as a strip above the code
  onLink?: (i: number) => void // user clicked links[i]
}

// One section per file, in order of first appearance in the notes.
// `focus` and every data-note/card/anchor index are step-global note indices.
export function CodeView({ step, files, focus, onFocus, blob, links, onLink }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  useEffect(() => {
    const b = box.current
    const el = b?.querySelector<HTMLElement>(`[data-anchor="${focus}"]`)
    const card = b?.querySelector<HTMLElement>(`[data-card="${focus}"]`)
    if (!b || !el || !card) return
    const y = (e: HTMLElement) => e.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop
    // Span start at 20% from the top, unless that pushes the card below the fold.
    const top = Math.max(y(el) - b.clientHeight * 0.2, y(card) + card.offsetHeight + 16 - b.clientHeight)
    b.scrollTo({ top, behavior: scrolled.current ? 'smooth' : 'auto' })
    scrolled.current = true
  }, [focus])

  const pick = (e: MouseEvent) => {
    if (!window.getSelection()?.isCollapsed) return // let people select code
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')
    if (hit) onFocus(Number(hit.dataset.note))
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      {!!links?.length && (
        <nav
          aria-label="In the flow"
          className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-4 py-1.5 text-xs whitespace-nowrap text-muted"
        >
          <span>In the flow:</span>
          {links.map((l, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onLink?.(i)}
              className="rounded-full border border-line px-2 py-0.5 hover:border-accent hover:text-fg"
            >
              {l.from} → {l.to} · <span className="font-mono">{l.label}</span>
            </button>
          ))}
        </nav>
      )}
      <div ref={box} onClick={pick} className="relative min-h-0 flex-1 overflow-auto">
        {[...new Set(step.notes.map((n) => n.file))].map((path) => {
          const file = files?.[path]
          if (file)
            return <FileBody key={path} step={step} path={path} file={file} focus={focus} href={blob && blob + path} />
          return (
            <section key={path} className="border-line not-first:border-t">
              <div className="p-6 text-sm text-muted">
                File not included in this dive: <code className="font-mono">{path}</code>
              </div>
              {step.notes.map(
                (n, i) =>
                  n.file === path && (
                    <NoteCard key={i} note={n} i={i} total={step.notes.length} active={i === focus} anchor />
                  ),
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function FileBody({
  step,
  path,
  file,
  focus,
  href,
}: {
  step: CodeStep
  path: string
  file: FileData
  focus: number
  href?: string
}) {
  const parsed = useMemo(() => parse(file), [file])
  // Global note index → row span in this file; notes in other files get null.
  const spans = useMemo(
    () => step.notes.map((n) => (n.file === path ? noteSpan(parsed.rows, n) : null)),
    [parsed, step.notes, path],
  )
  const [open, setOpen] = useState(() => new Set<number>())
  const items = useMemo(() => layout(parsed.rows, spans, open), [parsed, spans, open])

  const [tokens, setTokens] = useState<Tokens | null>(null)
  useEffect(() => {
    let live = true
    highlightFile(file, parsed).then((t) => live && setTokens(t))
    return () => {
      live = false
    }
  }, [file, parsed])

  // Which note owns each row: the active note wins, then the first covering note.
  const owner = useMemo(() => {
    const o = new Int16Array(parsed.rows.length).fill(-1)
    spans.forEach((s, i) => {
      if (s) for (let r = s[0]; r <= s[1]; r++) if (o[r] < 0 || i === focus) o[r] = i
    })
    return o
  }, [parsed, spans, focus])

  const cardsAfter = useMemo(() => {
    const m = new Map<number, number[]>()
    spans.forEach((s, i) => s && m.set(s[1], [...(m.get(s[1]) ?? []), i]))
    return m
  }, [spans])
  const unplaced = step.notes.flatMap((n, i) => (n.file === path && !spans[i] ? [i] : []))

  const active = step.notes[focus]
  const link =
    href && active?.file === path && active.side !== 'old' ? `${href}#L${active.lines[0]}-L${active.lines[1]}` : href
  const card = (i: number) => (
    <NoteCard
      key={`n${i}`}
      note={step.notes[i]}
      i={i}
      total={step.notes.length}
      active={i === focus}
      anchor={!spans[i]}
    />
  )

  return (
    <section className="border-line not-first:border-t">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm">
        {/* rtl + bdi: a long path loses its start, never the file name */}
        <span dir="rtl" title={path} className="truncate text-left font-mono font-medium">
          <bdi>{path}</bdi>
        </span>
        {file.oldPath && (
          <span title={file.oldPath} className="truncate text-xs text-muted">
            from {file.oldPath}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">
          {file.status && (
            <span className="rounded-full border border-line px-2 text-xs text-muted">{file.status}</span>
          )}
          {file.diff && (
            <span className="font-mono text-xs">
              <span className="text-green-700 dark:text-green-400">+{parsed.adds}</span>{' '}
              <span className="text-red-700 dark:text-red-400">−{parsed.dels}</span>
            </span>
          )}
          {link && (
            <a className="text-accent hover:underline" href={link} target="_blank" rel="noreferrer">
              Open on GitHub ↗
            </a>
          )}
        </span>
      </header>
      <div className="py-2 font-mono text-[13px] leading-6 [&_.tk]:[color:var(--shiki-light)] dark:[&_.tk]:[color:var(--shiki-dark)]">
        {unplaced.map(card)}
        {items.flatMap((it) =>
          it.kind === 'gap' ? (
            <button
              key={`g${it.start}`}
              onClick={() => setOpen((s) => new Set(s).add(it.start))}
              className="my-1 block w-full bg-bg py-1 text-center font-sans text-xs text-muted hover:text-accent"
            >
              ⋯ {it.end - it.start} unchanged lines
            </button>
          ) : (
            [
              <RowView
                key={it.i}
                row={parsed.rows[it.i]}
                tokens={tokens}
                diff={file.diff}
                note={owner[it.i]}
                band={owner[it.i] < 0 ? 0 : owner[it.i] === focus ? 2 : 1}
                dim={owner[it.i] !== focus}
                anchor={spans[focus]?.[0] === it.i ? focus : undefined}
              />,
              ...(cardsAfter.get(it.i) ?? []).map(card),
            ]
          ),
        )}
      </div>
    </section>
  )
}

const BAND = [
  '',
  'shadow-[inset_3px_0_0_color-mix(in_srgb,var(--color-accent)_40%,transparent)]',
  'shadow-[inset_4px_0_0_var(--color-accent)]',
]

const RowView = memo(function RowView(p: {
  row: Row
  tokens: Tokens | null
  diff: boolean
  note: number
  band: number
  dim: boolean
  anchor?: number
}) {
  const { row } = p
  if (row.type === 'hunk') return <div className="bg-bg px-4 text-xs leading-6 text-muted">{row.text}</div>
  const line = row.type === 'del' ? p.tokens?.old?.[row.o!] : p.tokens?.new?.[row.n!]
  const bg = row.type === 'add' ? 'bg-add' : row.type === 'del' ? 'bg-del' : p.band === 2 ? 'bg-mark' : ''
  const num = 'select-none pr-3 text-right text-muted tabular-nums'
  return (
    <div
      data-note={p.note >= 0 ? p.note : undefined}
      data-anchor={p.anchor}
      className={`grid transition-opacity duration-200 ${p.diff ? 'grid-cols-[3rem_3rem_1.5rem_1fr]' : 'grid-cols-[3.5rem_1fr]'} ${bg} ${BAND[p.band]} ${p.dim ? 'opacity-55' : ''} ${p.note >= 0 ? 'cursor-pointer' : ''}`}
    >
      {p.diff && <span className={num}>{row.old ?? ''}</span>}
      <span className={num}>{row.new ?? ''}</span>
      {p.diff && (
        <span className="select-none text-center text-muted">
          {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ''}
        </span>
      )}
      <span className="pr-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {line
          ? line.map((t, k) => (
              <span key={k} className="tk" style={t.htmlStyle as CSSProperties}>
                {t.content}
              </span>
            ))
          : row.text}
      </span>
    </div>
  )
})

function NoteCard(p: { note: CodeNote; i: number; total: number; active: boolean; anchor: boolean }) {
  const { note, i, total, active } = p
  const [a, b] = note.lines
  return (
    <div
      data-note={i}
      data-card={i}
      data-anchor={p.anchor ? i : undefined}
      className={`mx-4 my-2 cursor-pointer rounded-lg border px-4 py-3 font-sans transition-colors duration-200 ${
        active ? 'border-accent bg-surface text-fg' : 'border-line bg-bg text-muted'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <span className={`rounded-full px-2 font-medium ${active ? 'bg-mark text-fg' : 'bg-line'}`}>
          {i + 1}/{total}
        </span>
        <span>
          {a === b ? `Line ${a}` : `Lines ${a}–${b}`}
          {note.side === 'old' ? ' · removed code' : ''}
        </span>
      </div>
      <p className="text-[15px] leading-relaxed">
        <Inline text={note.text} />
      </p>
    </div>
  )
}
