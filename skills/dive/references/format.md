# Format

Each part file is one `Chapter`, as strict JSON: `<chapter id>.json`, or `walkthrough.<n>.json` for flow `n`. The build merges the parts in order.

```ts
interface Dive {
  title: string // "Retry failed refunds"
  summary: string // 1-2 short sentences: what this is and why it matters
  source: Source
  chapters: Chapter[] // fixed order (see ChapterId), without empty chapters
}

interface Source {
  kind: 'pr' | 'module' | 'question'
  ref: string // the input as given: PR URL/number, path, question
  url?: string // PR URL
  links?: Link[] // knowledge-base pages and tickets used as sources
}

type ChapterId = 'intro' | 'glossary' | 'big-picture' | 'walkthrough' | 'review-focus'

interface Chapter { id: ChapterId; title: string; steps: Step[] }

type Step = CardStep | TermsStep | CodeStep | SequenceStep | DiagramStep | QuizStep

// `say` is the narration: 1-3 short sentences shown above the visual.

interface CardStep {
  kind: 'card'
  title: string
  body: string // short text. "- " lines render as bullets, `backticks` as code
  links?: Link[]
}

interface TermsStep {
  kind: 'terms'
  title: string
  say?: string // one sentence that ties this group of terms to the one before
  terms: Term[] // also feed the glossary drawer available on every screen
}

interface Term {
  term: string
  meaning: string // 1-2 short sentences
  code?: string // identifier in code, e.g. "RefundJob"
}

interface CodeStep {
  kind: 'code'
  id?: string // target of Message.step, required in a flow
  title: string // names the piece of logic, never a file
  say: string
  notes: CodeNote[] // in execution order, across files. → moves note to note
}

interface CodeNote {
  file: string // repo path. The build embeds this file
  lines: [number, number] // inclusive range, in new-file numbers unless side = 'old'
  side?: 'new' | 'old' // 'old' for deleted lines
  text: string // 1-3 short sentences, like a PR self-review comment
}

// One shape, three roles:
// - 'sequence': the overview in big-picture. Its messages may link to flows.
// - 'flow': opens a flow in the walkthrough. The steps after it belong to the flow, up to the next 'flow':
//   code steps, one quiz, then optional 'edge' steps.
// - 'edge': an optional edge case of the current flow. Edge steps come last in their flow.
interface SequenceStep {
  kind: 'sequence' | 'flow' | 'edge'
  id?: string // 'flow': required, the target of overview links
  title: string
  say: string
  actors: Actor[]
  messages: Message[] // revealed one by one with →
}

interface Actor {
  id: string
  label: string // the code name ("RefundService"), the provider ("Stripe"), or the role ("Database", "Message bus")
  category: Category // colors the head and the lifeline
  group?: string // the app, without its path, or "outside" for people and providers, or "infra" for data and messaging
  change?: Change // PR: a unit the change adds, changes or removes
}

type Category = 'person' | 'service' | 'provider' | 'data' | 'messaging'

type Change = 'added' | 'changed' | 'removed'

interface Message {
  from: string // actor id
  to: string // actor id
  label: string // "POST /refunds"
  note: string // one short sentence shown when this message is active
  type?: 'call' | 'return' | 'async' | 'error' // default 'call'
  step?: string // id of the step that shows this message: a code step in the same flow, or a flow (overview)
  change?: Change // PR: how this hop differs from base
}

interface DiagramStep {
  kind: 'diagram'
  title: string
  say: string
  nodes: { id: string; label: string; group?: string }[]
  edges: { from: string; to: string; label?: string }[]
  notes?: DiagramNote[] // → moves note to note. Focused nodes are highlighted
}

interface DiagramNote { focus: string[]; text: string } // focus: node ids

interface QuizStep {
  kind: 'quiz'
  title: string
  question: string
  options: QuizOption[] // 3-4 plausible options, exactly one correct. The app shuffles them
}

interface QuizOption { text: string; correct?: boolean; why: string } // why: one sentence, why this option is right or wrong

interface Link { title: string; url: string }
```

## What the build rejects

`dive.py check` runs these checks on one part. It does not check the links from the overview to the flows, because the flows are in other parts.

- A field the types mark without `?` that is missing or empty (`""`, `[]`), a required text field that is not a string, or a `kind`, `type`, `side`, `change` or `category` outside the listed values. A chapter id outside `ChapterId`. A `group` that is not a string.
- `flow` and `edge` steps outside `walkthrough`, or a `sequence` inside it. A walkthrough part that does not start with its `flow` step. A non-`edge` step after an `edge` step.
- A missing or repeated id. Ids are lowercase words joined by dashes (`send-refund`), unique in the whole dive. Every `flow` step and every code step in `walkthrough` needs one.
- A message `step` that is not a code step of the same flow (in the overview: not a flow id). A code step that no message of its `flow` step links to. Code steps out of the order of their first linking message.
- Two actors of a step with the same id. A `from` or `to` that is not an actor of the step. A message after the first whose sender no earlier message came from or reached, except in the overview, where each flow starts from its own entry. `change` outside a PR dive.
- A code note on a test file, or on a file that does not exist (in a PR: at head, or changed), or with `lines` outside the file. `side: "old"` on a file the PR did not change.
- Two nodes of a diagram with the same id, or two edges with the same `from` and `to`. A diagram edge or `focus` that names no node. A diagram with notes where some node is in the `focus` of no note.
- A quiz without 3-4 options and exactly one `"correct": true`. Any truthy `correct`, even `"false"`, counts as correct.

## Example: `parts/walkthrough.1.json`

```json
{
  "id": "walkthrough",
  "title": "Walkthrough",
  "steps": [
    {
      "kind": "flow",
      "id": "attempt",
      "title": "Send one refund attempt",
      "say": "The worker takes each due refund, counts the attempt, and sends it to the gateway once.",
      "actors": [
        { "id": "worker", "label": "runWorker", "category": "service", "group": "refund worker", "change": "changed" },
        { "id": "retry", "label": "retryRefund", "category": "service", "group": "refund worker" },
        { "id": "gateway", "label": "Stripe", "category": "provider", "group": "outside" }
      ],
      "messages": [
        { "from": "worker", "to": "worker", "label": "incrementAttempts(id)", "note": "The count goes up before the call.", "step": "attempt-count", "change": "added" },
        { "from": "worker", "to": "retry", "label": "retryRefund(refund)", "note": "The worker passes the refund with the new count." },
        { "from": "retry", "to": "gateway", "label": "refund()", "note": "The call sends the refund id as the idempotency key." },
        { "from": "gateway", "to": "retry", "label": "200 OK", "type": "return", "note": "The gateway accepted the refund." }
      ]
    },
    {
      "kind": "code",
      "id": "attempt-count",
      "title": "The worker counts each attempt",
      "say": "The worker now saves the attempt count before it sends the refund.",
      "notes": [
        { "file": "src/refunds/worker.ts", "lines": [7, 7], "side": "old", "text": "Before, the worker sent the refund without counting." },
        { "file": "src/refunds/worker.ts", "lines": [7, 8], "text": "The count goes up first. If the process crashes during the call, the attempt still counts." }
      ]
    },
    {
      "kind": "quiz",
      "title": "Check",
      "question": "The process crashes during the gateway call. What happens to the attempt count?",
      "options": [
        { "text": "It keeps the attempt, because the worker saved it before the call.", "correct": true, "why": "`incrementAttempts` runs before `retryRefund`." },
        { "text": "It drops the attempt, because the call did not finish.", "why": "The count is saved before the call starts." },
        { "text": "It resets to 0 on the next run.", "why": "Nothing resets the count." }
      ]
    }
  ]
}
```
