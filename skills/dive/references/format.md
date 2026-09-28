# Format

You write `dive.json` in step 3: the frame, with `"chapters": []`. Writers put each chapter in `parts/<id>.json`, and each flow of the walkthrough in `parts/walkthrough.<n>.json` (n is the flow's place in the outline, from 1). Each part file holds one `Chapter`. `dive.py build` merges the parts into `dive.json` (the walkthrough parts in numeric order, the chapters in `ChapterId` order), fills `source.repo`, `base`, and `head`, and embeds the code. JSON only: no comments, no trailing commas. The length limits for step fields are in writing.md.

```ts
// dive.json
interface Dive {
  title: string // "Retry failed refunds"
  summary: string // 1-2 short sentences: what this is and why it matters
  source: Source
  chapters: Chapter[] // [] in step 3; build fills it from parts/
}

interface Source {
  kind: 'pr' | 'module' | 'question'
  ref: string // the input as given: PR URL/number, path, question
  url?: string // PR URL
  links?: Link[] // knowledge-base pages and tickets used as sources
}

// parts/<id>.json, parts/walkthrough.<n>.json
type ChapterId = 'intro' | 'glossary' | 'big-picture' | 'walkthrough' | 'review-focus' | 'recap'

interface Chapter { id: ChapterId; title: string; steps: Step[] }

type Step = CardStep | TermsStep | CodeStep | SequenceStep | DiagramStep | QuizStep
// `say` is the narration shown above the visual.

interface CardStep {
  kind: 'card'
  title: string
  body: string // "- " lines render as bullets, `backticks` as code
  links?: Link[]
}

interface TermsStep {
  kind: 'terms'
  title: string
  say?: string // ties this group of terms to the one before
  terms: Term[] // also feed the glossary drawer on every screen
}

interface Term { term: string; meaning: string; code?: string } // code: the identifier, e.g. "RefundJob"

interface CodeStep {
  kind: 'code'
  id?: string // target of Message.step; required in the walkthrough
  title: string // names the piece of logic, never a file
  say: string
  notes: CodeNote[] // in execution order, across files
}

interface CodeNote {
  file: string // repo path; repeat it on each note in the same file
  lines: [number, number] // inclusive; head (new-file) numbers unless side = 'old'
  side?: 'new' | 'old' // 'old' for deleted lines, with base line numbers
  text: string // like a PR self-review comment
}
// A PR shows each file's diff; otherwise the file.

// One shape, three roles:
// - 'sequence': the overview in big-picture. Its messages may link to flows.
// - 'flow': opens a flow in the walkthrough. The steps after it belong to the flow, up to the next 'flow'.
// - 'edge': an optional edge case of the current flow. Edge steps come last in their flow.
interface SequenceStep {
  kind: 'sequence' | 'flow' | 'edge'
  id?: string // 'flow': required, the target of overview links
  title: string
  say: string
  actors: Actor[]
  messages: Message[]
}

interface Actor {
  id: string
  label: string // the code unit ("EnterEarnActionService") or the system ("Postgres")
  group?: string // deployable app or "outside"; drawn as a band, collapsible into one lane
  change?: Change // PR: a unit the change adds, changes or removes
}

type Change = 'added' | 'changed' | 'removed'

interface Message {
  from: string // actor id
  to: string // actor id
  label: string // "POST /refunds"
  note: string
  type?: 'call' | 'return' | 'async' | 'error' // default 'call'
  step?: string // a code step id in the same flow (flow, edge), or a flow id (overview)
  change?: Change // PR: how this hop differs from base
}

interface DiagramStep {
  kind: 'diagram'
  title: string
  say: string
  nodes: { id: string; label: string; group?: string }[]
  edges: { from: string; to: string; label?: string }[]
  notes?: DiagramNote[] // revealed one by one; each adds its focus nodes
}

interface DiagramNote { focus: string[]; text: string } // focus: node ids

interface QuizStep {
  kind: 'quiz'
  title: string
  question: string
  options: QuizOption[] // the app shuffles them
}

interface QuizOption { text: string; correct?: boolean; why: string }

interface Link { title: string; url: string }
```

## Structure

The build rejects a dive that breaks these rules:

- `flow` and `edge` steps appear only in `walkthrough`. `sequence` steps appear only outside it.
- `walkthrough` starts with a `flow`. After an `edge`, only `edge` steps follow until the next `flow`. A flow has at most 2 `edge` steps.
- Every `flow` step and every `code` step in `walkthrough` has an `id`: lowercase letters, digits, and dashes, unique in the dive.
- `Message.step` in a `flow` or `edge` is the id of a code step in the same flow. In the overview `sequence`, it is the id of a flow.
- Each code step in a flow has a link from at least one message of its `flow` step, so no code is off the map. Code steps come in the order of their first linking message.
- `change` appears only in a PR dive. `group` is a string.

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
        { "id": "worker", "label": "runWorker", "group": "refund worker" },
        { "id": "store", "label": "RefundStore", "group": "refund worker" },
        { "id": "pg", "label": "Postgres", "group": "database" },
        { "id": "retry", "label": "retryRefund", "group": "refund worker", "change": "changed" },
        { "id": "gateway", "label": "Payment gateway", "group": "outside" }
      ],
      "messages": [
        { "from": "worker", "to": "store", "label": "due()", "note": "The worker asks for refunds whose retry time has come." },
        { "from": "store", "to": "pg", "label": "SELECT due refunds", "note": "A refund is due when its `next_attempt_at` has passed." },
        { "from": "pg", "to": "store", "label": "rows", "type": "return", "note": "Each row carries the `attempts` count." },
        { "from": "store", "to": "worker", "label": "due refunds", "type": "return", "note": "The worker handles them one by one." },
        { "from": "worker", "to": "store", "label": "incrementAttempts(id)", "note": "The count goes up before the call.", "step": "count", "change": "added" },
        { "from": "worker", "to": "retry", "label": "retryRefund(refund)", "note": "The worker passes the refund with the new count.", "step": "count", "change": "changed" },
        { "from": "retry", "to": "gateway", "label": "refund()", "note": "The call sends the refund id as the idempotency key.", "step": "send", "change": "changed" },
        { "from": "gateway", "to": "retry", "label": "200 OK", "type": "return", "note": "The gateway accepted the refund." },
        { "from": "retry", "to": "store", "label": "markDone(id)", "note": "The refund is complete." }
      ]
    },
    {
      "kind": "code",
      "id": "count",
      "title": "The worker counts each attempt",
      "say": "The worker now saves the attempt count before it sends the refund.",
      "notes": [
        { "file": "src/refunds/worker.ts", "lines": [7, 7], "side": "old", "text": "Before, the worker sent the refund without counting." },
        { "file": "src/refunds/worker.ts", "lines": [7, 8], "text": "The count goes up first. If the process crashes during the call, the attempt still counts." }
      ]
    },
    {
      "kind": "code",
      "id": "send",
      "title": "The refund id is the key",
      "say": "The gateway call now carries an idempotency key.",
      "notes": [
        { "file": "src/refunds/retry.ts", "lines": [6, 6], "side": "old", "text": "Before, a repeated call looked like a new refund." },
        { "file": "src/refunds/retry.ts", "lines": [19, 19], "text": "The refund id is the key. The gateway ignores a refund it already did." }
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
    },
    {
      "kind": "edge",
      "title": "The gateway times out after it refunded",
      "say": "The gateway refunds, but its reply never arrives. The next attempt sends the same key.",
      "actors": [
        { "id": "worker", "label": "runWorker", "group": "refund worker" },
        { "id": "retry", "label": "retryRefund", "group": "refund worker", "change": "changed" },
        { "id": "gateway", "label": "Payment gateway", "group": "outside" },
        { "id": "store", "label": "RefundStore", "group": "refund worker" }
      ],
      "messages": [
        { "from": "retry", "to": "gateway", "label": "refund()", "note": "The gateway refunds the customer.", "step": "send" },
        { "from": "gateway", "to": "retry", "label": "timeout", "type": "error", "note": "The reply is lost." },
        { "from": "retry", "to": "store", "label": "scheduleRetry(id, delay)", "note": "A timeout is retryable." },
        { "from": "store", "to": "worker", "label": "due again", "type": "async", "note": "After the delay, the next run gets the refund back." },
        { "from": "worker", "to": "retry", "label": "retryRefund(refund)", "note": "The worker sends the refund again." },
        { "from": "retry", "to": "gateway", "label": "refund()", "note": "The call sends the same key as before.", "step": "send" },
        { "from": "gateway", "to": "retry", "label": "200 OK", "type": "return", "note": "The gateway sees the key and does not refund twice." }
      ]
    }
  ]
}
```
