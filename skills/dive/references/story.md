# Story

Tell the story as the author of the change who explains it to a reviewer. Start from the fundamentals and add one layer at a time: the happy path first, then the edge cases. Split a complex domain into layers or regions that the reader takes in one at a time. Show only what matters.

The story plan gives the reader's level: `new` means they barely know this domain, `familiar` means they work in it. Explain as much as that reader needs.

## Skeleton

| id | Purpose | Typical steps |
|---|---|---|
| `why` | The problem and the decision behind it, with sources | 1-2 cards with links to the PR, tickets, pages |
| `glossary` | The words the rest of the dive uses | 1 terms step, 3-10 terms |
| `big-picture` | The layers or regions and how they depend on each other | 1 diagram per layer or region, sequence, quiz |
| `walkthrough` | The whole code walkthrough, bottom-up (see **Order**) | code steps, quiz |
| `edge-cases` | Designed behavior for failures, limits, odd inputs | code steps, sequence, quiz |
| `review-focus` | PR only: suspected bugs, risks, what to check | 1 card |
| `recap` | Only facts no earlier step said, and "Also changed" | 1-2 cards |

Keep this order. Leave out a chapter that has nothing true to say. Readers jump between chapters, so each chapter must make sense on its own after the glossary.

## What goes in

**Importance rule**: each note must help the reader understand the change. Drop:

- a note on unchanged code. When the order of unchanged checks matters, say it in one sentence in `say`.
- internals of vendored or inlined code that the change does not use. Note only the parts it uses (see **New names**).
- a fact another step already said.
- a test note that only repeats the behavior note above it.

Importance, not brevity: never drop a detail the reader needs to understand the change.

- **Once**: say each fact once, in the step where the reader sees it in code. Other steps build on it.
- **New names**: the first time a note names a function, constant or type from the diff, that code gets its own note before the note that names it. For a function, note the line that matters to the story, not the whole body. Example: one note on the list of runtime error messages, then one note on the line of `isRawNetworkError` that checks a message against that list. The other lines of `isRawNetworkError` get no note.
- **Order**: `walkthrough` goes bottom-up: new types and constants, then the data model, migrations and services, then the flow in execution order, from entry point to effect.
- **Designed or suspected**: `edge-cases` holds only designed behavior. Suspected bugs and risks go only to `review-focus`.
- **Tests**: put a test note right after the note on the behavior it proves, in the same step, only when the test adds something. List other tests in the "Also changed" card.
- **Also changed**: mechanical changes (renames, formatting, generated code, lockfiles, doc comments) go in one card in `recap`. Write each path in backticks. Put no notes on imports and exports: list the file in the card.
- **Soft budget**: a typical PR (about 400 changed lines) reads in about 10 minutes: about 1,800 words of prose and 25 code notes. The budget grows with the domain. Go over it when the facts matter. `dive.py build` prints the counts.

## Step kinds

- `card`: problem, decision, review focus, recap. At most 5 bullets.
- `terms`: the glossary. Give the identifier in code for each term.
- `code`: one piece of logic. `title` and `say` describe it and hold for the whole step. Title the logic, never a file: "A fetch failure becomes a NetworkError", not "The NetworkError class". Notes follow execution order and may cross files (A → B → A is fine). Each note sits on the lines it explains and says what the author would tell a reviewer about them: what they do and why. Never cite line numbers in text: give those lines their own note. 1-3 sentences per note, about 15 lines per range at most.
- `sequence`: a flow across 3 or more actors (services, classes, modules), one message per call. At most about 10 messages: show one pass of a loop, not every repeat. Add a `note` to the messages that matter. Use `return` for replies, `error` for failures, `async` for queued work.
- `diagram`: static structure of one layer or region: which parts exist and what depends on what. 3-10 nodes. Use notes to walk through it. Draw one for a simple change. Add one per extra layer or region of a complex change, and no more.
- `quiz`: one at the end of `big-picture`, `walkthrough`, and `edge-cases`.

## Quizzes

- Test understanding: a consequence, a cause, or the result of a given input. Never trivia such as names or line numbers.
- 3-4 options. Each wrong option is a mistake a smart reader could make, so every option sounds plausible. Keep options similar in length and form.
- Exactly one correct option. Each option has a one-sentence `why`.
- Earlier steps of the dive contain the answer.

## outline.md

Design the story first, in a `## Story plan` section before any step:

1. The change in one sentence.
2. The level and its reason, from `dive.py level`.
3. The layers the reader must learn, bottom-up: types and constants → data model → migrations → services and how they depend on each other → the request flow. List only the layers this change has. Use the `[<layer>, <core|detail>]` tags on the notes' Flow items.
4. The big-picture diagrams, one line each: the layer or region it shows.
5. Left out: one line per group of dropped note items, with the reason.

Then one line per step: kind, code refs in note order, one-line intent, and the notes to read.

```md
# Retry failed refunds with backoff
Failed refunds now retry with growing, random waits and stop after 5 attempts.

## Story plan
- Change: the worker replaces fixed 60-second retries with capped random backoff and an idempotency key.
- Level: familiar (14 of your commits touch src/refunds in the last year)
- Layers: `MAX_ATTEMPTS` and the wait cap → `retryRefund` → the worker loop
- Diagrams: the worker, `retryRefund` and the gateway
- Left out: gateway client internals (unchanged); log wording (no behavior change)

## walkthrough
- code src/refunds/retry.ts:3-5 - the limits: `MAX_ATTEMPTS` and the wait cap that `nextDelay` doubles - notes/refunds.md
- code src/refunds/worker.ts:7-8 → src/refunds/retry.ts:9 → src/refunds/retry.ts:19 - one attempt: count it, `nextDelay` caps the wait, send with an idempotency key - notes/refunds.md
- quiz - a timeout after the gateway already refunded

## recap
- card: Also changed - `package-lock.json`, `src/refunds/index.ts` (rename)
```
