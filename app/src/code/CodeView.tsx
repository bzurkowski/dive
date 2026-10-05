import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Inline } from '../Inline'
import { ExternalLink } from '../shell/Steps'
import type { StepViewProps } from '../shell/nav'
import type { CodeNote, CodeStep, FileData } from '../types'
import { highlightFile, type Tokens } from './highlight'
import { layout, noteSpan, parse, type Row } from './rows'

export interface CodeLink {
  from: string
  to: string
  label: string
}

type Props = StepViewProps<CodeStep> & {
  files?: Record<string, FileData>
  blob?: string
  links?: CodeLink[]
  onLink: (i: number) => void
}

// `focus`, data-note and data-card hold step-global note indices, across files.
export function CodeView({ step, files, focus, onFocus, blob, links, onLink }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  useLayoutEffect(() => {
    const b = box.current
    const card = b?.querySelector<HTMLElement>(`[data-card="${focus}"]`)
    if (!b || !card) return
    const el = b.querySelector<HTMLElement>('[data-anchor]') ?? card
    const y = (e: HTMLElement) => e.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop
    // Note start 20% from the top, unless its card would fall below the fold.
    const top = Math.max(y(el) - b.clientHeight * 0.2, y(card) + card.offsetHeight + 16 - b.clientHeight)
    // 'auto' follows the CSS of the container: smooth unless the reader prefers reduced motion.
    b.scrollTo({ top, behavior: scrolled.current ? 'auto' : 'instant' })
    scrolled.current = true
  }, [step, focus])

  const pick = (e: MouseEvent) => {
    if (!window.getSelection()?.isCollapsed) return // let people select code
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-note]')
    if (hit) onFocus(Number(hit.dataset.note))
  }

  return (
    <div className="flex h-full flex-col">
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
              onClick={() => onLink(i)}
              className="rounded-full border border-line px-2 py-0.5 hover:border-accent hover:text-fg"
            >
              {l.from} → {l.to} · <span className="font-mono">{l.label}</span>
            </button>
          ))}
        </nav>
      )}
      <div ref={box} onClick={pick} className="min-h-0 flex-1 overflow-auto motion-safe:scroll-smooth">
        {/* dive.py build embeds the file of every note */}
        {[...new Set(step.notes.map((n) => n.file))].map((path) => (
          <FileBody key={path} step={step} path={path} file={files![path]} focus={focus} blob={blob} />
        ))}
      </div>
    </div>
  )
}

function FileBody({
  step,
  path,
  file,
  focus,
  blob,
}: {
  step: CodeStep
  path: string
  file: FileData
  focus: number
  blob?: string
}) {
  const rows = useMemo(() => parse(file), [file])
  const spans = useMemo(
    () => step.notes.map((n) => (n.file === path ? noteSpan(rows, n) : null)),
    [rows, step.notes, path],
  )
  const [open, setOpen] = useState(() => new Set<number>())
  const items = useMemo(() => layout(rows, spans, open), [rows, spans, open])

  const [tokens, setTokens] = useState<Tokens | null>(null)
  useEffect(() => {
    highlightFile(file, rows).then(setTokens)
  }, [file, rows])

  const covers = (s: [number, number] | null, r: number) => !!s && s[0] <= r && r <= s[1]
  const owner = (r: number) => (covers(spans[focus], r) ? focus : spans.findIndex((s) => covers(s, r)))

  const active = step.notes[focus]
  const href = blob && file.status !== 'deleted' ? blob + path.split('/').map(encodeURIComponent).join('/') : ''
  // plain=1: a rendered file (Markdown, notebook) ignores line anchors.
  const [a, b] = active.lines
  const link = href && active.file === path && active.side !== 'old' ? `${href}?plain=1#L${a}-L${b}` : href
  const card = (i: number) => <NoteCard key={`n${i}`} notes={step.notes} i={i} focus={focus} />
  const count = (type: Row['type']) => rows.filter((r) => r.type === type).length

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
            <span className="text-xs tabular-nums">
              <span className="text-ok">+{count('add')}</span> <span className="text-bad">−{count('del')}</span>
            </span>
          )}
          {link && (
            <ExternalLink className="text-accent hover:underline" href={link}>
              Open on GitHub <span aria-hidden>↗</span>
            </ExternalLink>
          )}
        </span>
      </header>
      <div className="py-2 font-mono text-[13px] leading-6 [&_.tk]:[color:var(--shiki-light)] dark:[&_.tk]:[color:var(--shiki-dark)]">
        {items.flatMap((it) => {
          if (it.kind === 'gap')
            return (
              <button
                key={`g${it.start}`}
                type="button"
                onClick={() => setOpen((s) => new Set(s).add(it.start))}
                className="my-1 block w-full bg-bg py-1 text-center font-sans text-xs text-muted hover:text-fg"
              >
                <span aria-hidden>⋯</span> {it.end - it.start} unchanged lines
              </button>
            )
          const note = owner(it.i)
          return [
            <RowView
              key={it.i}
              row={rows[it.i]}
              tokens={tokens}
              diff={file.diff}
              note={note}
              active={note === focus}
              anchor={spans[focus]?.[0] === it.i}
            />,
            ...spans.flatMap((s, i) => (s?.[1] === it.i ? [card(i)] : [])),
          ]
        })}
      </div>
    </section>
  )
}

const RowView = memo(function RowView(p: {
  row: Row
  tokens: Tokens | null
  diff: boolean
  note: number // owning note, -1 for none
  active: boolean
  anchor: boolean
}) {
  const { row } = p
  const line = row.type === 'del' ? p.tokens?.old?.[row.old! - 1] : p.tokens?.new?.[row.new! - 1]
  const tint = row.type === 'add' ? 'bg-add' : row.type === 'del' ? 'bg-del' : ''
  const mark = p.active ? 'bg-mark' : ''
  const band = p.active
    ? 'shadow-[inset_4px_0_0_var(--color-accent)]'
    : p.note >= 0
      ? 'shadow-[inset_3px_0_0_color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
      : ''
  // Ink on the highlighter: muted falls under 4.5:1 on the dark olive.
  const ink = p.active ? 'text-fg' : 'text-muted'
  const num = `select-none pr-3 text-right tabular-nums ${ink} ${mark}`
  // The band sits on the first cell: on the row, the highlighter of the cell would hide it.
  const first = `${num} ${band}`
  return (
    <div
      data-note={p.note >= 0 ? p.note : undefined}
      data-anchor={p.anchor || undefined}
      className={`grid transition-opacity duration-200 ${p.diff ? 'grid-cols-[3rem_3rem_1.5rem_1fr] max-sm:grid-cols-[2.75rem_2.75rem_0.75rem_1fr]' : 'grid-cols-[3.5rem_1fr]'} ${tint} ${p.active ? '' : 'opacity-55'} ${p.note >= 0 ? 'cursor-pointer' : ''}`}
    >
      {p.diff && <span className={first}>{row.old ?? ''}</span>}
      <span className={p.diff ? num : first}>{row.new ?? ''}</span>
      {p.diff && (
        <span className={`select-none text-center ${ink}`}>
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

function NoteCard({ notes, i, focus }: { notes: CodeNote[]; i: number; focus: number }) {
  const note = notes[i]
  const [a, b] = note.lines
  const active = i === focus
  return (
    <div
      data-note={i}
      data-card={i}
      aria-current={active || undefined}
      className={`mx-4 my-2 cursor-pointer rounded-lg border px-4 py-3 font-sans transition-colors duration-200 ${
        active ? 'border-accent bg-surface text-fg' : 'border-line bg-bg text-muted'
      }`}
    >
      <p className="mb-1 text-xs text-muted">
        {a === b ? `Line ${a}` : `Lines ${a}–${b}`}
        {note.side === 'old' ? ' · removed code' : ''}
      </p>
      <p className="text-[15px] leading-relaxed">
        <Inline text={note.text} />
      </p>
    </div>
  )
}
