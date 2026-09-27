# Story

A dive answers, in order: why does this exist, which words do I need, what are the parts, how does the normal case run, how does it fail, and what should I check.

## Skeleton

| id | Purpose | Typical steps |
|---|---|---|
| `why` | The problem and the decision behind it, with sources | 1-2 cards with links to the PR, tickets, pages |
| `glossary` | The words the rest of the dive uses | 1 terms step, 3-10 terms |
| `big-picture` | The parts and how they connect | diagram, sequence, quiz |
| `happy-path` | The normal case, in execution order | code steps, sequence, quiz |
| `edge-cases` | Failures, limits, odd inputs | code steps, sequence, quiz |
| `review-focus` | PR only: risks and what to check | 1 card |
| `recap` | The facts to keep, and "Also changed" | 1-2 cards |

Keep this order. Leave out a chapter that has nothing true to say. Readers jump between chapters, so each chapter must make sense on its own after the glossary.

## Capacity

The story grows with the domain. Completeness wins for behavior:

- Every behavior change gets a place: a code note, a sequence message, or a diagram note. No chapter has a size limit.
- Mechanical changes (renames, formatting, generated code, lockfiles, doc comments) go in one "Also changed" card in `recap`. Write each path in backticks. Put no notes on imports and exports: list the file in the card, and it covers those hunks.
- Say each fact once, in the step where the reader sees it in code. Other steps build on it and do not repeat it. `review-focus` and `recap` hold only what earlier steps did not say, or at most 5 short bullets.
- Cut words, never facts. One idea per step and per note. A typical PR reads in about 10 minutes.
- Order by execution, not by file: follow a request from its entry point to its effect.
- Tests: when a test backs a critical path, put its note right after the note on the behavior it proves, in the same step. List other tests in the "Also changed" card.

## Step kinds

- `card`: problem, decision, review focus, recap. At most 5 bullets.
- `terms`: the glossary. Give the identifier in code for each term.
- `code`: one piece of logic. `title` and `say` describe it and hold for the whole step. Title the logic, never a file: "A fetch failure becomes a NetworkError", not "The NetworkError class". Notes follow execution order and may cross files (A → B → A is fine). Write each note as the author's **self-review** of the PR: it sits on the lines it explains and says what they do and why. Never cite line numbers in text: give those lines their own note. Show a constant or type before the notes that use it. 1-3 sentences per note, about 15 lines per range at most.
- `sequence`: a flow across 3 or more actors (services, classes, modules), one message per call. At most about 10 messages: show one pass of a loop, not every repeat. Add a `note` to the messages that matter. Use `return` for replies, `error` for failures, `async` for queued work.
- `diagram`: static structure: which parts exist and what depends on what. 3-10 nodes. Use notes to walk through it.
- `quiz`: one at the end of `big-picture`, `happy-path`, and `edge-cases`.

## Quizzes

- Test understanding: a consequence, a cause, or the result of a given input. Never trivia such as names or line numbers.
- 3-4 options. Each wrong option is a mistake a smart reader could make, so every option sounds plausible. Keep options similar in length and form.
- Exactly one correct option. Each option has a one-sentence `why`.
- Earlier steps of the dive contain the answer.

## outline.md

One line per step: kind, code refs in execution order, one-line intent, and the notes to read.

```md
# Retry failed refunds with backoff
Failed refunds now retry with growing, random waits and stop after 5 attempts.

## why
- card: the problem with fixed 60-second retries - notes/context.md

## happy-path
- code src/refunds/worker.ts:7-8 → src/refunds/retry.ts:7-26 - one attempt: count it, back off, send with an idempotency key - notes/refunds.md
- quiz - a timeout after the gateway already refunded

## recap
- card: Also changed - `package-lock.json`, `src/refunds/index.ts` (rename)
```
