import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Inline } from '../Inline'
import type { CodeNote, CodeStep, FileData, StepViewProps } from '../types'
import { highlightFile, type Tokens } from './highlight'
import { layout, noteSpan, parse, type Row } from './rows'

type Props = StepViewProps<CodeStep> & { file?: FileData; href?: string }

export function CodeView(props: Props) {
  if (!props.file)
    return (
      <div className="p-6 text-sm text-muted">
        File not included in this dive: <code className="font-mono">{props.step.file}</code>
      </div>
    )
  // Fresh state (expanded gaps, scroll) per step.
  return <CodeBody key={`${props.step.file}\n${props.step.title}`} {...props} file={props.file} />
}

function CodeBody({ step, file, focus, onFocus, href }: Props & { file: FileData }) {
  const parsed = useMemo(() => parse(file), [file])
  const spans = useMemo(() => step.notes.map((n) => noteSpan(parsed.rows, n)), [parsed, step.notes])
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
  const unplaced = step.notes.flatMap((_, i) => (spans[i] ? [] : [i]))

  const box = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-anchor="${focus}"]`)
    if (!box.current || !el) return
    const b = box.current
    const top = el.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - b.clientHeight * 0.2
    b.scrollTo({ top, behavior: scrolled.current ? 'smooth' : 'auto' })
    scrolled.current = true
  }, [focus])

  const pick = (e: MouseEvent) => {
    if (!window.getSelection()?.isCollapsed) return // let people select code
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')
    if (hit) onFocus(Number(hit.dataset.note))
  }

  const active = step.notes[focus]
  const link =
    href && active && active.side !== 'old' && !href.includes('#')
      ? `${href}#L${active.lines[0]}-L${active.lines[1]}`
      : href
  const hasNotes = step.notes.length > 0
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2 text-sm">
        <span className="truncate font-mono font-medium">{step.file}</span>
        {file.status && <span className="rounded-full border border-line px-2 text-xs text-muted">{file.status}</span>}
        {file.oldPath && <span className="truncate text-xs text-muted">from {file.oldPath}</span>}
        {file.diff && (
          <span className="font-mono text-xs">
            <span className="text-green-700 dark:text-green-400">+{parsed.adds}</span>{' '}
            <span className="text-red-700 dark:text-red-400">−{parsed.dels}</span>
          </span>
        )}
        {link && (
          <a className="ml-auto shrink-0 text-accent hover:underline" href={link} target="_blank" rel="noreferrer">
            Open on GitHub ↗
          </a>
        )}
      </header>
      <div
        ref={box}
        onClick={pick}
        className="relative min-h-0 flex-1 overflow-auto py-2 font-mono text-[13px] leading-6 [&_.tk]:[color:var(--shiki-light)] dark:[&_.tk]:[color:var(--shiki-dark)]"
      >
        {unplaced.map(card)}
        {items.map((it) =>
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
                dim={hasNotes && owner[it.i] !== focus}
                anchor={spans[focus]?.[0] === it.i ? focus : undefined}
              />,
              ...(cardsAfter.get(it.i) ?? []).map(card),
            ]
          ),
        )}
      </div>
    </div>
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
      data-anchor={p.anchor ? i : undefined}
      className={`mx-4 my-2 cursor-pointer rounded-lg border px-4 py-3 font-sans transition-colors duration-200 ${
        active ? 'border-accent bg-surface text-fg shadow-md' : 'border-line bg-bg text-muted'
      }`}
    >
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        <span className={`rounded-full px-2 font-medium ${active ? 'bg-accent text-surface' : 'bg-line'}`}>
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
