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

Start where execution starts and go one layer deeper at a time: the happy path first, then the edge cases. Split a complex domain into layers or regions that the reader takes in one at a time. Show only what matters.

The story plan gives the reader's level: `new` means they barely know this domain, `familiar` means they work in it. Explain as much as that reader needs.

## Skeleton

| id | PR | Module or question | Typical steps |
|---|---|---|---|
| `why` | The problem and the decision behind it, with sources | What the code is for and who calls it. For a question, the answer in 2-3 sentences | 1-2 cards with links to the PR, tickets, pages |
| `glossary` | The words the rest of the dive uses | same | 1 terms step |
| `big-picture` | The layers or regions and how they depend on each other. Show the code around the scope as context: its callers (the notes' Entry points) and what it calls (Calls out). Diagram nodes, not code notes | same | 1 diagram per layer or region, sequence, quiz |
| `walkthrough` | The diff, top-down (see **Order**) | The main flow, top-down (see **Order**). Not every line: only what the story needs | code steps, quiz |
| `edge-cases` | Designed behavior for failures, limits, odd inputs | same | code steps, sequence, quiz |
| `review-focus` | Suspected bugs, risks, what to check before approval | Suspected bugs, traps for the next person who changes the code, docs the code contradicts | 1 card |
| `recap` | Only facts no earlier step said, and "Also changed" | Only facts no earlier step said, and where to read next | 1-2 cards |

Keep this order. Leave out a chapter that has nothing true to say. Readers jump between chapters, so each chapter must make sense on its own after the glossary.

## What goes in

**Importance rule**: each note must help the reader understand the change (PR) or the main flow (module, question). Drop:

- PR: a note on unchanged code. When the order of unchanged checks matters, say it in one sentence in `say`.
- Module or question: a note on code off the main flow, or code that does not help answer the question.
- internals of vendored or inlined code that the scope does not use. Note only the parts it uses (see **New names**).
- a fact another step already said.
- a test note that only repeats the behavior note above it.

Importance, not brevity: never drop a detail the reader needs.

- **Once**: say each fact once, in the step where the reader sees it in code. Other steps build on it.
- **New names**: the first time a note names a function, constant or type from the scope, say in a few words what it does. When it matters to the story, its own note comes after, where execution reaches it. For a function, note the line that matters to the story, not the whole body. Example: one note on the line of `isRawNetworkError` that checks a message against a list of runtime error messages, then one note on that list. The other lines of `isRawNetworkError` get no note.
- **Order**: `walkthrough` goes top-down, in execution order: from the entry point, through the services, to the effect. Follow a call into a function when the story needs it. Note a type or constant where the code uses it. In a PR, only the new or changed code.
- **Designed or suspected**: `edge-cases` holds only designed behavior. Suspected bugs and risks go only to `review-focus`.
- **Tests**: put a test note right after the note on the behavior it proves, in the same step, only when the test adds something. List other tests in a `recap` card.
- **Also changed** (PR): mechanical changes (renames, formatting, generated code, lockfiles, doc comments) go in one card in `recap`. Write each path in backticks. Put no notes on imports and exports: list the file in the card.
- **Soft budget**: a dive reads in about 10 minutes: about 1,800 words of prose and 25 code notes. That fits a PR of about 400 changed lines, or the main flow of a module. The budget grows with the domain. Go over it when the facts matter. `dive.py build` prints the counts.

## Step kinds

- `card`: problem, decision, answer, review focus, recap.
- `terms`: the glossary. Give each term's identifier in `code` when it has one.
- `code`: one piece of logic. `title` and `say` describe it and hold for the whole step. Title the logic, never a file: "A fetch failure becomes a NetworkError", not "The NetworkError class". Notes follow execution order and may cross files (A → B → A is fine). Each note sits on the lines it explains and says what the author (PR) or owner (module, question) would say about them: what they do and why. Never cite line numbers in text: give those lines their own note.
- `sequence`: a flow across 3 or more actors (services, classes, modules), one message per call. Show one pass of a loop, not every repeat. Add a `note` to the messages that matter. Use `return` for replies, `error` for failures, `async` for queued work.
- `diagram`: static structure of one layer or region: which parts exist and what depends on what. Use notes to walk through it. Draw one for a simple scope. Add one per extra layer or region of a complex scope, and no more.
- `quiz`: one at the end of `big-picture`, `walkthrough`, and `edge-cases`.

## Quizzes

- Test understanding: a consequence, a cause, or the result of a given input. Never trivia such as names or line numbers.
- Each wrong option is a mistake a smart reader could make, so every option sounds plausible. Keep options similar in length and form.
- Earlier steps of the dive contain the answer.
