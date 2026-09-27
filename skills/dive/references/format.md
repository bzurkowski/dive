# Format

You write `dive.json` in step 3: the frame, with `"chapters": []`. Writers put each chapter in `parts/<id>.json`, or `parts/<id>.1.json`, `parts/<id>.2.json` when a chapter is split. `dive.py build` merges the parts into `dive.json`, fills `source.repo`, `base`, and `head`, and embeds the code. JSON only: no comments, no trailing commas.

```ts
// dive.json
interface Dive {
  title: string // 3-7 words
  summary: string // 1-2 short sentences: what this is and why it matters
  source: {
    kind: 'pr' | 'module' | 'question' | 'doc'
    ref: string // the argument as given
    url?: string // PR or page URL
    links?: Link[] // knowledge pages and tickets used as sources
  }
  chapters: Chapter[] // [] in step 3; build fills it from parts/
}

// parts/<id>.json
interface Chapter {
  id: 'why' | 'glossary' | 'big-picture' | 'happy-path' | 'edge-cases' | 'review-focus' | 'recap'
  title: string
  steps: Step[]
}

type Step = Card | Terms | Code | Sequence | Diagram | Quiz
// `say` is the narration above the visual: 1-3 short sentences.

interface Card { kind: 'card'; title: string; body: string; links?: Link[] }
// body: short text; "- " lines are bullets, `backticks` are code

interface Terms { kind: 'terms'; title: string; terms: { term: string; meaning: string; code?: string }[] }
// meaning: one sentence; code: the identifier, e.g. "RefundJob"

interface Code { kind: 'code'; title: string; say: string; notes: CodeNote[] }
interface CodeNote {
  file: string // repo path; repeat it on each note in the same file
  lines: [number, number] // inclusive; head (new-file) line numbers
  side?: 'new' | 'old' // 'old' for deleted lines, with base line numbers
  text: string // 1-3 sentences, like a PR self-review comment
}
// notes: in execution order, across files when the logic crosses them.
// A PR shows each file's diff; otherwise the file.

interface Sequence {
  kind: 'sequence'; title: string; say: string
  actors: { id: string; label: string }[]
  messages: { from: string; to: string; label: string; note?: string; type?: 'call' | 'return' | 'async' | 'error' }[]
}

interface Diagram {
  kind: 'diagram'; title: string; say: string
  nodes: { id: string; label: string; group?: string }[]
  edges: { from: string; to: string; label?: string }[]
  notes?: { focus: string[]; text: string }[] // focus: node ids
}

interface Quiz {
  kind: 'quiz'; title: string; question: string
  options: { text: string; correct?: boolean; why: string }[] // 3-4 options, exactly one correct
}

interface Link { title: string; url: string }
```

## Example: `parts/happy-path.json`

```json
{
  "id": "happy-path",
  "title": "Happy path",
  "steps": [
    {
      "kind": "code",
      "title": "One refund attempt",
      "say": "The worker counts the attempt, then retryRefund sends one call to the gateway.",
      "notes": [
        { "file": "src/refunds/worker.ts", "lines": [7, 8], "text": "The worker counts the attempt before the call. A crash during the call still uses up an attempt." },
        { "file": "src/refunds/retry.ts", "lines": [9, 9], "side": "old", "text": "Before: every failure waited 60 seconds and retried forever." },
        { "file": "src/refunds/retry.ts", "lines": [19, 19], "text": "The refund id is the idempotency key. A repeated call cannot refund twice." }
      ]
    },
    {
      "kind": "quiz",
      "title": "Check",
      "question": "The gateway times out after it refunded. What happens on the next attempt?",
      "options": [
        { "text": "The gateway sees the same key and does not refund again.", "correct": true, "why": "The idempotency key makes the repeat safe." },
        { "text": "The worker skips the refund because the attempt count went up.", "why": "The count only stops retries after 5 attempts." },
        { "text": "The customer gets a second refund.", "why": "That was the old behavior; the key prevents it." }
      ]
    }
  ]
}
```
