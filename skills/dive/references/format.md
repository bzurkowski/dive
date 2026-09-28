# Format

Each part file holds one `Chapter`. Write strict JSON: no comments, no trailing commas. The string limits are in writing.md.

```ts
interface Dive {
  title: string // "Retry failed refunds"
  summary: string // 1-2 short sentences: what this is and why it matters
  source: Source
  chapters: Chapter[] // fixed order, see ChapterId; empty chapters are left out
}

interface Source {
  kind: 'pr' | 'module' | 'question'
  ref: string // the input as given: PR URL/number, path, question
  url?: string // PR URL
  links?: Link[] // knowledge-base pages and tickets used as sources
}

type ChapterId = 'intro' | 'glossary' | 'big-picture' | 'walkthrough' | 'review-focus' | 'recap'

interface Chapter { id: ChapterId; title: string; steps: Step[] }

type Step = CardStep | TermsStep | CodeStep | SequenceStep | DiagramStep | QuizStep

// `say` is the narration: 1-3 short sentences shown above the visual.

interface CardStep {
  kind: 'card'
  title: string
  body: string // short text; "- " lines render as bullets, `backticks` as code
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
  id?: string // target of Message.step; required in a flow
  title: string // names the piece of logic, never a file
  say: string
  notes: CodeNote[] // in execution order, across files; → moves note to note
}

interface CodeNote {
  file: string // repo path, key into Dive.files
  lines: [number, number] // inclusive range; new-file numbers unless side = 'old'
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
  label: string // the code unit ("EnterEarnActionService") or the system ("Postgres")
  group?: string // deployable app or "outside"; drawn as a band, collapsible into one lane
  change?: Change // PR: a unit the change adds, changes or removes
}

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
  notes?: DiagramNote[] // → moves note to note; focused nodes are highlighted
}

interface DiagramNote { focus: string[]; text: string } // focus: node ids

interface QuizStep {
  kind: 'quiz'
  title: string
  question: string
  options: QuizOption[] // 3-4 plausible options, exactly one correct; the app shuffles them
}

interface QuizOption { text: string; correct?: boolean; why: string } // why: one sentence, why this option is right or wrong

interface Link { title: string; url: string }
```

## Structure

`dive.py build` rejects the dive when a part breaks any of these rules. Check your part against each one before you save it.

- **Fields**: in your part, every field that the types above mark without `?` is present and not empty. `""` and `[]` count as missing, so a diagram needs at least one edge. Every `kind`, `type`, `side` and `change` is one of the values the types list.
- **Placement**: `flow` and `edge` steps appear only in `walkthrough`, and `sequence` steps only outside it. Each walkthrough part starts with its `flow` step. Only `edge` steps follow an `edge` step, and a flow has at most 2 of them.
- **Ids**: every `flow` step, every code step in `walkthrough`, and every other step that has an `id` has an id of lowercase letters and digits in words joined by single dashes (`send-refund`). Each id is unique in the whole dive.
- **Links**: in a `flow` or `edge` step, `Message.step` is the id of a code step in the same flow. In the overview, it is the id of a flow. Every code step of a flow is linked from a message of its `flow` step (links from `edge` steps do not count). Code steps come in the order of their first linking message in the `flow` step.
- **Sequences**: `from` and `to` are actor ids of the same step. Every message after the first starts from an actor that an earlier message of the step came from or reached. A step has at most 30 actors. `change` appears only in a PR dive.
- **Code notes**: `file` is a file the PR changed or a file at head (PR), or a file in the working tree (otherwise). `lines` is `[start, end]` with 1 <= start <= end <= the last line of that side of the file. `side: "old"` needs a file the PR changed, and its lines are base numbers.
- **Diagrams**: every edge endpoint and every `focus` id is a node id. When a diagram has notes, every node is in the `focus` of some note.
- **Quizzes**: 3-4 options, and exactly one has `"correct": true` (the boolean, not the string).

The reader sees the code that the build embeds. In a PR, a file the PR changed shows as its full diff, and any other file shows as its text at head. Outside a PR, a file shows as it is in the working tree. The view folds unchanged lines far from a change or a code note.

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
        { "id": "worker", "label": "runWorker", "group": "refund worker", "change": "changed" },
        { "id": "store", "label": "RefundStore", "group": "refund worker" },
        { "id": "retry", "label": "retryRefund", "group": "refund worker", "change": "changed" },
        { "id": "pg", "label": "Postgres", "group": "database" },
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
        { "id": "worker", "label": "runWorker", "group": "refund worker", "change": "changed" },
        { "id": "store", "label": "RefundStore", "group": "refund worker" },
        { "id": "retry", "label": "retryRefund", "group": "refund worker", "change": "changed" },
        { "id": "gateway", "label": "Payment gateway", "group": "outside" }
      ],
      "messages": [
        { "from": "retry", "to": "gateway", "label": "refund()", "note": "The gateway refunds the customer.", "step": "send", "change": "changed" },
        { "from": "gateway", "to": "retry", "label": "timeout", "type": "error", "note": "The reply is lost." },
        { "from": "retry", "to": "store", "label": "scheduleRetry(id, delay)", "note": "A timeout is retryable." },
        { "from": "store", "to": "worker", "label": "due again", "type": "async", "note": "After the delay, the next run gets the refund back." },
        { "from": "worker", "to": "retry", "label": "retryRefund(refund)", "note": "The worker sends the refund again.", "change": "changed" },
        { "from": "retry", "to": "gateway", "label": "refund()", "note": "The call sends the same key as before.", "step": "send", "change": "changed" },
        { "from": "gateway", "to": "retry", "label": "200 OK", "type": "return", "note": "The gateway sees the key and does not refund twice." }
      ]
    }
  ]
}
```
