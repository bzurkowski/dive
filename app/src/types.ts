// Data contract for a dive. Single source of truth.
// Agents author `dive.json`, except `files` and the git fields of `source` (repo, base, head).
// `dive.py build` fills those and bakes the result into index.html. It rejects a dive where
// a field without `?` is missing or empty ("" or []), so app code can rely on them.
// Mirror authored changes in every copy that AGENTS.md lists under "Data contract".

export interface Dive {
  title: string // "Retry failed refunds"
  summary: string // 1-2 short sentences: what this is and why it matters
  source: Source
  chapters: Chapter[] // fixed order (see ChapterId), without empty chapters
  files?: Record<string, FileData> // baked by dive.py build, keyed by repo path
}

export interface Source {
  kind: 'pr' | 'module' | 'question'
  ref: string // the input as given: PR URL/number, path, question
  url?: string // PR URL
  repo?: string // "owner/name", used for GitHub links
  base?: string // base commit sha (pr)
  head?: string // head commit sha (pr), else the commit the dive was built at
  links?: Link[] // knowledge-base pages and tickets used as sources. The build adds every card link
}

export type ChapterId = 'intro' | 'glossary' | 'big-picture' | 'walkthrough' | 'review-focus'

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
  body: string // short text. "- " lines render as bullets, `backticks` as code
  links?: Link[]
}

export interface TermsStep {
  kind: 'terms'
  title: string
  say?: string // one sentence that ties this group of terms to the one before
  terms: Term[] // also feed the glossary drawer available on every screen
}

export interface Term {
  term: string
  meaning: string // 1-2 short sentences
  code?: string // identifier in code, e.g. "RefundJob"
}

export interface CodeStep {
  kind: 'code'
  id?: string // target of Message.step, required in the walkthrough
  title: string // names the piece of logic, never a file
  say: string
  notes: CodeNote[] // in execution order, across files. → moves note to note
}

export interface CodeNote {
  file: string // repo path, key into Dive.files
  lines: [number, number] // inclusive range, in new-file numbers unless side = 'old'
  side?: 'new' | 'old' // 'old' for deleted lines
  text: string // 1-3 short sentences, like a PR self-review comment
}

// One shape, three roles:
// - 'sequence': the overview in big-picture. Its messages may link to flows.
// - 'flow': opens a flow in the walkthrough. The steps after it belong to the flow, up to the next 'flow':
//   code steps, one quiz, then optional 'edge' steps.
// - 'edge': an optional edge case of the current flow. Edge steps come last in their flow.
export interface SequenceStep {
  kind: 'sequence' | 'flow' | 'edge'
  id?: string // 'flow': required, the target of overview links
  title: string
  say: string
  actors: Actor[]
  messages: Message[] // revealed one by one with →
}

export interface Actor {
  id: string
  label: string // the code name ("RefundService"), the provider ("Stripe"), or the role ("Database", "Message bus")
  category: Category // colors the head and the lifeline
  group?: string // the app, without its path, or "outside" for people and providers. Data and messaging take none
  change?: Change // PR: a unit the change adds, changes or removes
}

export type Category = 'person' | 'service' | 'provider' | 'data' | 'messaging'

export type Change = 'added' | 'changed' | 'removed'

export interface Message {
  from: string // actor id
  to: string // actor id
  label: string // "POST /refunds"
  note: string // one short sentence shown when this message is active
  type?: 'call' | 'return' | 'async' | 'error' // default 'call'
  step?: string // id of the step that shows this message: a code step in the same flow, or a flow (overview)
  change?: Change // PR: how this hop differs from base
}

export interface DiagramStep {
  kind: 'diagram'
  title: string
  say: string
  nodes: { id: string; label: string; group?: string }[]
  edges: { from: string; to: string; label?: string }[]
  notes?: DiagramNote[] // → moves note to note. Focused nodes are highlighted
}

export interface DiagramNote {
  focus: string[] // node ids
  text: string
}

export interface QuizStep {
  kind: 'quiz'
  title: string
  question: string
  options: QuizOption[] // 3-4 plausible options, exactly one correct. The app shuffles them
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
  lang: string // shiki language id, e.g. "ts" or "python", or "text" if unknown
  diff: boolean // true: `text` is a full-context unified diff body (' ', '+', '-' prefixed lines, no headers)
  text: string // file content (diff = false) or diff body (diff = true)
  status?: 'added' | 'modified' | 'deleted' | 'renamed'
  oldPath?: string // for renames
}
