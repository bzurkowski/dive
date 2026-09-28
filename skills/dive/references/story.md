# Story

## The reader

The reader has already read a lot of code today. They want to know what this code really does, and they check each claim against the code. They have little attention to spare, so walk them through it:

- one small step at a time, with one new idea per step,
- in plain words and short sentences,
- with each claim on the lines that show it.

With too much text or too many new ideas at once, they stop following.

## What a dive explains

A dive explains one of two things:

- **PR**: the change. Tell it as the author of the change who explains it to a reviewer.
- **Module or question**: how code that exists works. Tell it as the owner of the code who shows it to a new teammate. For a question, the scope is only the code that answers it.

Start where execution starts and follow it to its effect: the happy path first, then the edge cases. Split a large domain into flows that the reader takes one at a time. Show only what matters.

The story plan gives the reader's level: `new` means they barely know this domain, `familiar` means they work in it. Explain as much as that reader needs.

## Skeleton

| id | PR | Module or question | Typical steps |
|---|---|---|---|
| `intro` | The problem, the constraint, the decision, and what the decision means for the code, with sources | What the code is for, who uses it, and how it is turned on. For a question, the answer first | a chain of cards, with links to the PR, tickets, pages |
| `glossary` | The words the rest of the dive uses | same | terms steps, one per group of terms |
| `big-picture` | The story from far above | same | overview sequence, concepts, quiz |
| `walkthrough` | The change, flow by flow | The main flows. Not every line: only what the story needs | per flow: flow, code steps, quiz, edge steps |
| `review-focus` | Suspected bugs, risks, what to check before approval | Suspected bugs, traps for the next person who changes the code, docs the code contradicts | 1 card |
| `recap` | Only facts no earlier step said, "Also changed", where to read next, "Other flows" | Only facts no earlier step said, where to read next, "Other flows" | 1-3 cards |

Keep this order. Leave out a chapter that has nothing true to say. Readers jump between chapters, so each chapter must make sense on its own after the glossary. "Other flows" lists the flows the dive left out, one line each.

## Intro

A chain of short cards, one topic each, in the order of the skeleton. Tell the whole story the walkthrough needs. More cards with less on each beat one dense card.

## Glossary

Order the terms by dependency: each meaning uses only terms defined above it, or plain words. Group the terms by concept into small `terms` steps, such as "Stellar basics", then "An Earn action", then "Who pays". Each step's `say` ties its group to the group before. For a `new` reader, a primer card (such as "Stellar in five facts") may open the chapter. The app collects every term in a glossary drawer.

## Big picture

The story from far above, in this order:

1. **Overview**: one `sequence` at the level of the groups (the widget, the backend, the vendor, the chain). Each message links to the flow that zooms into it, so the overview is the map of the walkthrough. Skip it when the dive has one flow.
2. **Concepts**: only the abstractions the flows depend on, such as a state machine, the data model, which parts depend on which, or who trusts whom. Each concept is one diagram or card. Its `say` states the one question it answers.
3. One quiz.

A diagram tells a story through its notes. The app reveals it note by note. The first note shows the entry nodes. Each later note adds the nodes in its `focus`. Nodes that no note has named yet show as ghosts. So each note builds on the note before, and every node is in the `focus` of some note.

## Flows

The walkthrough is one or more **flows**. A flow is one sequence plus the code that implements it, in this order:

1. the `flow` step: the happy path. Its `say` tells where we are and how we got here from the flow before.
2. code steps, in the order of the messages that link to them,
3. one quiz,
4. 0-2 `edge` steps. They come last, so the reader can skip them.

Title a flow by what it achieves: "Build the unsigned transaction". Use no number and no "Phase" or "Flow" prefix.

When to split:

- Start a new flow for each separate trigger: a user action, a job, a webhook, a consumer.
- Split one long flow (about 15 messages or more) only where control stops anyway: a wait for the user (signing), an async queue hop, or a handoff with a persisted status. Never split in the middle of a call chain.
- A simple PR or module has one flow.
- Keep about 5 flows at most. Beyond that, keep the flows that matter most, and list the rest in "Other flows".

## Sequences

The sequences are the spine of the dive: the reader maps each message to the code.

- **Actors** are the code units whose code the walkthrough shows: a controller, service, adapter, job, store, handler, or a module that owns functions. Label each with its code name (`EnterEarnActionService`). External systems are actors too: Postgres, a queue, a vendor API, a chain. Pure helpers and value objects are not actors: name them in the message note. Set each actor's `group` to its deployable app, or "outside". List the actors of one group next to each other, so the app draws one band per group.
- **Messages**: one message per call. Show one pass of a loop, not every repeat. Each message starts from an actor that has control: the one the previous message reached, or a caller still waiting on its call. Every message has a `note`. Use `return` for replies, `error` for failures, `async` for queued work. Queued work reaches its worker with an `async` message. An in-process check is a message from an actor to itself.
- **Every hop**: keep every message of a chain. To shorten a flow, split it at a stop (see **Flows**).
- **Links**: a message's `step` names the code step that shows the code that sends or handles it. Every call that enters code in scope links to a step (in a PR, every changed call). Returns and external hops may have none. Several messages may link to one code step.
- **PR**: the `flow` step shows the whole flow, with the hops the PR does not change, so the reader sees where the change sits. A PR that touches one hop still gets its full flow. Mark the actors and messages the PR adds, changes, or removes with `change`. Only changed messages link to code steps. Unchanged hops get a note but no code. When the point of the PR is new failure handling, that handling is the story: it goes in the flow, with the rejection as an `error` message.

## Edge cases

An `edge` step shows one branch as a sequence, never as code steps. It starts at the message where the path leaves the happy path and ends at the outcome: a status, an error, a retry. Its messages may link to code steps of the same flow that show the guard.

An edge case is designed behavior that changes an outcome the reader cares about: state (a timeout, a failed status), money (no fee paid), a retry, a double-submit guard. Plain input validation is not an edge case. In a PR, show only the edge cases that the PR adds or changes.

- A guard on the happy path stays in the code step that shows it, as the check it is. Its rejection branch may become an edge step.
- A designed recovery path with its own trigger (a recovery job, a retry consumer) is a flow when it is central to the scope. Otherwise it goes in "Other flows".
- Suspected bugs and risks go only to `review-focus`.

## What goes in

**Importance rule**: each note must help the reader understand the change (PR) or the main flow (module, question). Drop:

- PR: a code note on unchanged code. When the order of unchanged checks matters, say it in one sentence in `say`.
- Module or question: a note on code off the main flow, or code that does not help answer the question.
- internals of vendored or inlined code that the scope does not use. Note only the parts it uses (see **New names**).
- a fact another step already said.
- a test note that only repeats the behavior note above it.

Importance, not brevity: never drop a detail the reader needs.

- **Once**: say each fact once, in the step where the reader sees it in code. Other steps build on it. The story plan names the flow that introduces each new name. Other flows use the name without explaining it again.
- **New names**: the first time a note names a function, constant or type from the scope, say in a few words what it does. When it matters to the story, its own note comes after, where execution reaches it. For a function, note the line that matters to the story, not the whole body. Example: one note on the line of `isRawNetworkError` that checks a message against a list of runtime error messages, then one note on that list. The other lines of `isRawNetworkError` get no note.
- **Depth**: follow a call into a function when the story needs it. Note a type or constant where the code uses it. In a PR, only the new or changed code.
- **Tests**: put a test note right after the note on the behavior it proves, in the same step, only when the test adds something. List other tests in a `recap` card.
- **Also changed** (PR): mechanical changes (renames, formatting, generated code, lockfiles, doc comments) go in one card in `recap`. Write each path in backticks. Put no notes on imports and exports: list the file in the card.

## Step kinds

- `card`: an intro topic, a primer, a concept, review focus, recap.
- `terms`: one group of glossary terms. Give each term's identifier in `code` when it has one.
- `code`: one piece of logic. `title` and `say` describe it and hold for the whole step. Title the logic, never a file: "A fetch failure becomes a NetworkError", not "The NetworkError class". Notes follow execution order and may cross files (A → B → A is fine). Each note sits on the lines it explains and says what the author (PR) or owner (module, question) would say about them: what they do and why. Never cite line numbers in text: give those lines their own note.
- `sequence`: the overview in `big-picture`.
- `flow`: opens a flow in `walkthrough` (see **Flows** and **Sequences**).
- `edge`: an edge case of the current flow (see **Edge cases**).
- `diagram`: one concept in `big-picture`: which parts exist and what depends on what, a state machine, a data model.
- `quiz`: one at the end of `big-picture`, and one per flow.

## Quizzes

- Test understanding: a consequence, a cause, or the result of a given input. Never trivia such as names or line numbers.
- Each wrong option is a mistake a smart reader could make, so every option sounds plausible. Keep options similar in length and form.
- Earlier steps of the dive contain the answer.
