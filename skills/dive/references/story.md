# Story

## The reader

The reader has already read a lot of code today. They want to know what this code really does, and they check each claim against the code. Give them one new idea per step, and put each claim on the lines that show it.

In a PR, the author explains their own change to a reviewer. For a module or a question, the owner of the code shows it to a new teammate.

## Chapters

The chapters come in this order. Leave out a chapter that has nothing true to say.

| Chapter | What it holds |
|---|---|
| `intro` | PR: why the change exists. Module: what the code is for. Question: the answer first. |
| `glossary` | The domain words that the rest of the dive uses. |
| `big-picture` | The story from far above: the overview, the concepts, a quiz. |
| `walkthrough` | The flows, one after another. |
| `review-focus` | The risks: suspected bugs, traps, open questions, docs that the code contradicts. |
| `recap` | PR: "Also changed". Then "Other flows" and where to read next. |

Each fact comes once, in the step where the reader sees it in the code. Later steps build on it. Every risk goes in `review-focus`. The other chapters say what the code does.

## Intro

A short run of cards, one topic each. Each card follows from the one before it. For a PR: the problem, the constraint, the decision, then what the decision means for the code. For a module: what the code is for, who uses it, and what starts it (a route, a job, a flag, an import). For a question: the answer, then what the answer rests on.

## Glossary

Order the terms so that each meaning uses only the terms above it, or plain words. Group them in small `terms` steps, such as "Stellar basics", then "Who pays". For a `new` reader, open with a primer card, such as "Stellar in five facts", and define every domain term that the dive uses. For a `familiar` reader, define only the terms that this scope adds. Give a term its identifier in `code` when the code has one.

## Big picture

1. The **overview**: one `sequence` step, the map of the walkthrough. Its actors are the groups, such as the widget, the backend and the vendor. Each message links to the flow that zooms into it. Leave out the overview when the dive has one flow.
2. The **concepts** that the flows depend on, such as a state machine, the data model, or who calls whom. Each concept is one `diagram` step or one `card`. A diagram's notes show its nodes one note at a time, so start with the entry nodes and add a few nodes with each note.
3. One quiz.

## Flows

A flow is one sequence and the code behind its messages, in this order:

1. The `flow` step, which draws the main path. Its `say` opens with where the reader is: what starts the flow, or how they got here from the flow before.
2. The code steps, in the order that the flow's messages first link to them.
3. One quiz.
4. At most 2 `edge` steps. They come last, so that the reader can skip them.

Give a flow a title that says what it does: "Build the unsigned transaction".

The **main path** is the path that the change or the question is about. For a module, it is the usual path. It can be a failure path, when new failure handling is the point of a PR.

## Sequences

- An **actor** is a code unit that the walkthrough shows, by its code name (`RefundStore`), or an external system (Postgres, a queue, a vendor API). A helper function or a value is not an actor: name it in the message.
- An actor's **group** is the app or package that owns it, or `outside`. Keep the actors of one group next to each other.
- Draw one **message** for each call, return or queued message, and one pass of a loop. Each message starts from an actor that has control: the one that the last message reached, or a caller that waits for its call. A check inside one unit is a message from the actor to itself.
- **Link** each call into code in scope to the code step that shows its code. Returns, errors and messages from external systems can have no link. Several messages can link to one code step.
- In a PR, mark the actors and messages that the PR adds, changes or removes with `change`. Link only the changed messages.

## Edge steps

An **edge case** is designed behavior that changes an outcome the reader cares about: a state (a timeout, a failed status), money (a fee is not paid), a retry, or a guard against a double submit. Plain input validation is not an edge case. In a PR, only the edge cases that the PR adds or changes count.

Draw the edge cases whose outcomes matter most as edge steps, at most 2 per flow. An edge step starts at the message where the path leaves the main path, and ends at the outcome. It uses the flow's actors, with the same ids. Its messages can link to the flow's code steps. A guard that is on the main path is a code note in its code step.

## Code steps

A code step shows one piece of logic. Its title names the logic, not a file: "A fetch failure becomes a NetworkError". The code notes follow the order of execution, and can cross files.

- Put code notes only on the lines that the story depends on. In a PR, these are the new, changed or removed lines. For a module or a question, they are the lines on the main path.
- Follow a call into a function when the call matters for the story. Note a type or a constant where the code uses it.
- The first code note that names a function, constant or type says in a few words what it does. After that, use the name without the explanation.
- When a test shows a behavior better than the code does, put its code note right after the note on that behavior.

## Quizzes

A quiz tests understanding: a consequence, a cause, or the result of an input. Never ask trivia, such as names or line numbers. The answer is in an earlier step. Each wrong option is a mistake that a smart reader could make. Keep the options similar in length and form. The app shuffles them.
