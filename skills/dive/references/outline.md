# Outline

## From call chains to flows

Draft the sequences first: each hop of a call chain becomes one message. A hop that ends with `leaves: <path>` continues in the chain whose entry point is at `<path>` in another scout note. Keep every hop, in a PR the unchanged ones too, so the reader sees where the change sits. Leave out only a hop marked `detail`, or a whole chain whose heading is marked `detail`, and list it under Left out. Then split the messages into flows:

- Start a flow for each trigger: a user action, a job, a webhook, a consumer. A simple PR or module has one flow.
- Split a flow at a **stop**, and only there, when it has about 15 messages or more, or more than 30 actors (the most a sequence may have). A stop is where control stops anyway: a wait for the user (signing), an async hop to a queue or a job, or a handoff with a persisted status. A flow without a stop stays whole.
- Keep about 5 flows, the ones that matter most. Put each other flow, with its trigger, in Left out and in the recap card "Other flows".

Edge cases come from the `## Edge cases` of each scout note. An edge case is designed behavior that changes an outcome the reader cares about: state (a timeout, a failed status), money (no fee paid), a retry, or a double-submit guard. Plain input validation is not an edge case. In a PR, only the edge cases that the PR adds or changes count. Each item goes to at least one of these places:

- an edge step: at most 2 per flow, for the outcomes that matter most. story.md **Edge steps** says how to draw one.
- a code note in the code step that shows its guard: a guard on the main path is a check in its code step. Its rejection branch may also be an edge step.
- a flow: a designed recovery path with its own trigger (a recovery job, a retry consumer), when it is central to the scope. Otherwise it goes in Left out and "Other flows".
- Left out, with the reason: not an edge case by the definition above, or past the 2 edge steps of its flow.

## Story plan

- `Change:` (PR), `Does:` (module) or `Answer:` (question): the story in one sentence.
- `Level:` `new` or `familiar`, then the reason: the user's words, or the `reason=` that `dive.py level` printed.
- `Flows:` one line per flow, in order: `` `<id>` <title> - trigger: <trigger> ``. From the second flow on, add why it is split: its own trigger, or the stop it is split at.
- `New names:` the code names from the scope (functions, constants, types), each with the first flow whose code steps show it: `` `<name>`, `<name>` → `<flow id>` ``. A domain term goes in the glossary section instead. A name can be both.
- `Left out:` one line per group of dropped items: what, the scout-note section it comes from, and why.

## Outline format

- Line 1 is `# <dive title>`, line 2 the summary sentence: they become `title` and `summary` in `dive.json`. For a PR, line 3 is `PR: <url> · base <sha> · head <sha>`, with the shas that prep printed.
- Then the story plan, and one `##` section per chapter id, one line per step: `- <kind> <title> - <intent, one sentence> - <reads>`. `<reads>` names the code refs and the scout-note sections or grep terms: a writer reads only the story plan, its own sections, and what you cite.
- Each flow is `### flow <id>: <title>`, then:
  - `Actors:` `<id> <label> (<group>, <change>)`, comma-separated.
  - Messages, numbered: `<n>. <from> → <to>: <label> (<type>, <change>) - <anchor> → <code step id>`. Leave out the type `call` and an empty change. The anchor is the lines of the hop, as in the scout note.
  - `- code <id> - <refs> - <intent> - <reads>`. A ref is `path:start-end`, or `old path:start-end` for deleted lines.
  - `- quiz - <the question idea>`.
  - 0-2 `- edge <title>` lines, each with its numbered messages indented below it, in the same form, `change` included. Add an `Actors:` line only for actors the flow lacks.
- The overview in big-picture is `- sequence <title> - <intent>`, then its `Actors:` and numbered messages in the same form, without anchors, with `→ <flow id>` in place of a code step id.
- Titles and labels are drafts, because the writer owns every string. The ids, actors, messages and their order, and links are fixed.

## Example

```md
# Make refund retries safe
The worker counts each refund attempt, and the gateway call carries the refund id as an idempotency key.
PR: https://github.com/acme/payments/pull/318 · base 3f2a9c1 · head 8d41b7e

## Story plan
- Change: a retry after a gateway timeout can no longer refund the customer twice.
- Level: familiar - 14 of your commits touch src/refunds in the last year (new below 10)
- Flows: `attempt` Send one refund attempt - trigger: each worker run. One flow.
- New names: `incrementAttempts`, `idempotencyKey` → `attempt`
- Left out: log wording in `retryRefund` (notes/refunds.md Flow): no behavior change

## intro
- card A retry could refund twice - the old timeout path - notes/context.md Goal
- card The decision - the refund id becomes the idempotency key - notes/context.md Decisions

## glossary
- terms Refunds and attempts - Refund, Attempt, Idempotency key - notes/refunds.md Terms

## walkthrough
### flow attempt: Send one refund attempt
Actors: worker `runWorker` (refund worker, changed), store `RefundStore` (refund worker), retry `retryRefund` (refund worker, changed), pg Postgres (database), gateway Payment gateway (outside)
1. worker → store: due() - src/refunds/worker.ts:5
2. store → pg: SELECT due refunds - src/refunds/store.ts:12
3. pg → store: rows (return)
4. store → worker: due refunds (return) - src/refunds/store.ts:14
5. worker → store: incrementAttempts(id) (added) - src/refunds/worker.ts:7 → count
6. worker → retry: retryRefund(refund) (changed) - src/refunds/worker.ts:8 → count
7. retry → gateway: refund() (changed) - src/refunds/retry.ts:19 → send
8. gateway → retry: 200 OK (return)
9. retry → store: markDone(id) - src/refunds/retry.ts:20
- code count - src/refunds/worker.ts:7-8, old src/refunds/worker.ts:7 - the count goes up before the call - notes/refunds.md Flow
- code send - src/refunds/retry.ts:19, old src/refunds/retry.ts:6 - the refund id is the idempotency key - notes/refunds.md Flow
- quiz - a crash during the gateway call: does the attempt still count?
- edge The gateway times out after it refunded
  1. retry → gateway: refund() (changed) - src/refunds/retry.ts:19 → send
  2. gateway → retry: timeout (error)
  3. retry → store: scheduleRetry(id, delay) - src/refunds/retry.ts:26
  4. store → worker: due again (async) - src/refunds/store.ts:14
  5. worker → retry: retryRefund(refund) (changed) - src/refunds/worker.ts:8
  6. retry → gateway: refund() (changed) - src/refunds/retry.ts:19 → send
  7. gateway → retry: 200 OK (return)

## review-focus
- card What to check - the risks of the retry path - notes/refunds.md Risks and open questions, notes/context.md Open questions

## recap
- card Also changed - `src/refunds/index.ts` (import of `GatewayError`)
```

## The dive.json frame

```json
{ "title": "<line 1 of the outline>", "summary": "<line 2 of the outline>",
  "source": { "kind": "<kind>", "ref": "<the argument as given>", "url": "<the PR URL>",
    "links": [{ "title": "Refunds can go out twice (#301)", "url": "https://github.com/acme/payments/issues/301" }] },
  "chapters": [] }
```

Write `docs/dives/<slug>/dive.json` as strict JSON. Leave out `url` outside a PR. `links` holds each issue, ticket and page from `## Linked` in context.md and from knowledge.md. The build fills `chapters` from the part files, and `repo`, `base` and `head` itself. The frame copies `Dive` and `Source` from format.md: change them together.

## Checklist

The outline is done when every line holds for `outline.md` and `dive.json`, checked against the scout-note summaries. The build rejects a dive that breaks a line marked (build), so catch it here.

- Every hop of every call chain is a message in a flow or an edge step, or in Left out: a `detail` hop, or a hop of a flow you cut.
- Every `## Edge cases` item is in a place that **From call chains to flows** lists.
- PR: every `## Mechanical` item is in the recap card "Also changed".
- Every flow you cut is in Left out and in the recap card "Other flows".
- review-focus cites `### Risks and open questions` of every area scout note, and Open questions of context.md.
- Every flow in `Flows:` has its `### flow` section, in the same order. Every name in `New names:` has one flow.
- Each group's actors are next to each other.
- In flows and edges, every call into code in scope has an anchor (returns and messages from external systems may have none), and the links follow story.md **Links**, each as `→ <code step id>`.
- (build) Every flow id and code step id is lowercase letters and digits in words joined by single dashes, and no id is used twice.
- (build) A sequence has at most 30 actors, and `change` marks appear only in a PR.
- (build) Each message after the first starts from an actor that an earlier message of the same sequence came from or reached. If a left-out `detail` hop breaks this, restore the hop.
- (build) Every `→` in a flow or edge names a code step of the same flow, and in the overview a flow id. Every code step is linked from its flow's own list (links from edges do not count), and the code steps come in the order of their first link.
- (build) A flow has at most 2 edge steps, and they come last. An `old` ref names a file that the PR changed.
- `dive.json` holds the frame, with `links` from `## Linked` in context.md and from knowledge.md.
