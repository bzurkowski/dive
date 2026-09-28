// Data contract for a dive. Single source of truth.
// Agents author `dive.json` (everything except `files`).
// `dive.py build` adds `files` and bakes the result into index.html.
// Mirror authored changes in skills/dive/references/format.md.

export interface Dive {
  title: string // "Retry failed refunds"
  summary: string // 1-2 short sentences: what this is and why it matters
  source: Source
  chapters: Chapter[] // fixed order, see ChapterId; empty chapters are left out
  files?: Record<string, FileData> // baked by dive.py build, keyed by repo path
}

export interface Source {
  kind: 'pr' | 'module' | 'question' | 'doc'
  ref: string // the input as given: PR URL/number, path, question, page URL
  url?: string // PR or page URL
  repo?: string // "owner/name", used for GitHub links
  base?: string // base commit sha (pr)
  head?: string // head commit sha (pr) or current commit (module)
  links?: Link[] // knowledge-base pages and tickets used as sources
}

export type ChapterId = 'why' | 'glossary' | 'big-picture' | 'happy-path' | 'edge-cases' | 'review-focus' | 'recap'

export interface Chapter {
  id: ChapterId
  title: string
  steps: Step[]
}

export type Step = CardStep | TermsStep | CodeStep | SequenceStep | DiagramStep | QuizStep

// `say` is the narration: 1-3 short sentences shown above the visual.

export interface CardStep {
  kind: 'card'
  title: string
  body: string // short text; "- " lines render as bullets, `backticks` as code
  links?: Link[]
}

export interface TermsStep {
  kind: 'terms'
  title: string
  terms: Term[] // also feed the glossary drawer available on every screen
}

export interface Term {
  term: string
  meaning: string // one short sentence
  code?: string // identifier in code, e.g. "RefundJob"
}

export interface CodeStep {
  kind: 'code'
  title: string // names the piece of logic, never a file
  say: string
  notes: CodeNote[] // in execution order, across files; → moves note to note
}

export interface CodeNote {
  file: string // repo path, key into Dive.files
  lines: [number, number] // inclusive range; new-file numbers unless side = 'old'
  side?: 'new' | 'old' // 'old' for deleted lines
  text: string // 1-3 short sentences, like a PR self-review comment
}

export interface SequenceStep {
  kind: 'sequence'
  title: string
  say: string
  actors: { id: string; label: string }[]
  messages: Message[] // revealed one by one with →
}

export interface Message {
  from: string // actor id
  to: string // actor id
  label: string // "POST /refunds"
  note?: string // one short sentence shown when this message is active
  type?: 'call' | 'return' | 'async' | 'error' // default 'call'
}

export interface DiagramStep {
  kind: 'diagram'
  title: string
  say: string
  nodes: { id: string; label: string; group?: string }[]
  edges: { from: string; to: string; label?: string }[]
  notes?: DiagramNote[] // → moves note to note; focused nodes are highlighted
}

export interface DiagramNote {
  focus: string[] // node ids
  text: string
}

export interface QuizStep {
  kind: 'quiz'
  title: string
  question: string
  options: QuizOption[] // 3-4 plausible options, exactly one correct; the app shuffles them
}

export interface QuizOption {
  text: string
  correct?: boolean
  why: string // one sentence: why this option is right or wrong
}

export interface Link {
  title: string
  url: string
}

// Baked by dive.py build. Never authored.
export interface FileData {
  lang: string // shiki language id, e.g. "ts", "python"; "text" if unknown
  diff: boolean // true: `text` is a full-context unified diff body (' ', '+', '-' prefixed lines, no headers)
  text: string // file content (diff = false) or diff body (diff = true)
  status?: 'added' | 'modified' | 'deleted' | 'renamed'
  oldPath?: string // for renames
}

// Number of → positions inside a step. Code, sequence and diagram steps
// have one position per note or message; everything else has one.
export function stepSize(step: Step): number {
  switch (step.kind) {
    case 'code':
      return Math.max(1, step.notes.length)
    case 'sequence':
      return Math.max(1, step.messages.length)
    case 'diagram':
      return Math.max(1, step.notes?.length ?? 0)
    default:
      return 1
  }
}

// Props shared by the visual step components.
export interface StepViewProps<S extends Step> {
  step: S
  focus: number // active position, 0-based, < stepSize(step)
  onFocus: (i: number) => void // user clicked a note or message
}
