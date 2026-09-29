import { flowAt, flows, stepSize, type Pos } from './shell/nav.ts'
import type { CodeNote, Dive, SequenceStep } from './types.ts'

// Ask your agent about the current step: the facts the page holds, the prompt wording, the deep links.

export interface AskContext {
  title: string // dive title
  ref: string // source.ref
  pr: boolean
  base?: string
  head?: string
  repo?: string // "owner/name"
  dir?: string // the dive's folder: "docs/dives/<slug>" when cwd is known, else the absolute folder of a file:// page
  cwd?: string // absolute repo root, only for a file:// page under <root>/docs/dives/<slug>/
  step: string // "Walkthrough › Retry › Send the request (note 2 of 4)"
  refs: string[] // "path:12-30", or "old path:12-30" for a note on deleted lines
  note?: string
  flow?: string // flow id: its trace is <dir>/notes/flow-<id>.md
}

const noteRef = (n: CodeNote) => `${n.side === 'old' ? 'old ' : ''}${n.file}:${n.lines[0]}-${n.lines[1]}`

// Only a file:// page knows where it is: under <root>/docs/dives/<slug>/ that gives the repo root too.
function place(url: string): Pick<AskContext, 'dir' | 'cwd'> {
  const u = new URL(url)
  if (u.protocol !== 'file:') return {}
  const path = decodeURIComponent(u.pathname).replace(/^\/(?=[A-Za-z]:)/, '')
  const m = path.match(/^(.+)\/(docs\/dives\/[^/]+)\/(index\.html)?$/)
  return m ? { cwd: m[1], dir: m[2] } : { dir: path.replace(/\/[^/]*$/, '') }
}

export function askContext(dive: Dive, pos: Pos, url: string): AskContext {
  const { source } = dive
  const ch = dive.chapters[pos.c]
  const step = ch.steps[pos.s]
  const fl = flowAt(flows(ch.steps), pos.s)
  const n = stepSize(step)
  const crumb = [ch.title, fl && pos.s > fl.s && ch.steps[fl.s].title, step.kind === 'edge' && 'Edge cases', step.title]
  const ctx: AskContext = {
    title: dive.title,
    ref: source.ref,
    pr: source.kind === 'pr',
    base: source.base,
    head: source.head,
    repo: source.repo,
    ...place(url),
    step:
      crumb.filter(Boolean).join(' › ') +
      (n > 1 ? ` (${'messages' in step ? 'message' : 'note'} ${pos.f + 1} of ${n})` : ''),
    refs: [],
    flow: fl && (ch.steps[fl.s] as SequenceStep).id,
  }
  switch (step.kind) {
    case 'code': {
      const note = step.notes[pos.f]
      ctx.refs = [noteRef(note)]
      ctx.note = note.text
      break
    }
    case 'diagram':
      ctx.note = step.notes?.[pos.f]?.text
      break
    case 'sequence':
    case 'flow':
    case 'edge': {
      const m = step.messages[pos.f]
      ctx.note = `${m.label}: ${m.note}`
      if (step.kind === 'sequence') ctx.flow = m.step
      for (const s of dive.chapters.flatMap((c) => c.steps))
        if (s.kind === 'code' && s.id && s.id === m.step) ctx.refs = [...new Set(s.notes.map(noteRef))]
    }
  }
  return ctx
}

export function askPrompt(ctx: AskContext, question: string): string {
  const { title, ref, pr, base, head, dir, step, refs, note, flow } = ctx
  const trace = dir ? `${dir}/notes/flow-${flow}.md` : `notes/flow-${flow}.md in the dive's folder`
  return [
    `I'm reading the dive "${title}"${dir ? ` (${dir}/index.html)` : ''}, a walkthrough of ${ref}.`,
    `Step: ${step}`,
    refs.length > 0 && `Code: ${refs.join(', ')}`,
    note && `Note: ${note}`,
    flow && `Trace of this flow: ${trace}, other traces in the same folder. Read it first, then the code.`,
    head && `The code is at commit ${head}: read a file with \`git show ${head}:<path>\`.`,
    pr && base && head && `The change is \`git diff ${base} ${head} -- <path>\`; old lines are at ${base}.`,
    `\nMy question: ${question.trim()}`,
  ]
    .filter(Boolean)
    .join('\n')
}

// ponytail: claude-cli caps q at 5000 chars and nothing here trims to it; shorten refs and notes if prompts outgrow it.
export function askTargets(ctx: AskContext, prompt: string): { label: string; href: string }[] {
  const q = encodeURIComponent(prompt)
  const at = ctx.cwd ? `&cwd=${encodeURIComponent(ctx.cwd)}` : ctx.repo ? `&repo=${encodeURIComponent(ctx.repo)}` : ''
  return [
    { label: 'Claude Code', href: `claude-cli://open?q=${q}${at}` },
    { label: 'VS Code', href: `vscode://anthropic.claude-code/open?prompt=${q}` },
    { label: 'Cursor', href: `cursor://anysphere.cursor-deeplink/prompt?text=${q}` },
  ]
}
