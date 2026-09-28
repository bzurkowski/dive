# Story

## The reader

The reader has already read a lot of code today. They want to know what this code really does, and they check each claim against the code. Walk them through it one small step at a time, with one new idea per step and each claim on the lines that show it.

The story plan's `Level:` line says how well the reader knows the domain. For `new` (they barely know it), open the glossary with a primer card, such as "Stellar in five facts", and define every domain term the dive uses. For `familiar` (they work in it), define only the domain terms this scope adds.

## Voice

A PR is a **self-review**: the author explains their own change to a reviewer. For a module or question, the owner of the code shows it to a new teammate. In both voices:

- Concrete over abstract, numbers over adjectives: name the file, function, field or value. "`MAX_ATTEMPTS` is 5", not "a limit". "Waits up to 32 s", not "waits a long time".
- Say what the code does, then why it matters.
- Present tense for how the code works now. Past tense for old behavior: "Before, every failure waited 60 s."

## Skeleton

The chapters, in order. Leave out a chapter that has nothing true to say.

| id | PR | Module or question | Steps |
|---|---|---|---|
| `intro` | Why the change exists, with sources | What the code is for. For a question, the answer first | a build-up of cards |
| `glossary` | The words the rest of the dive uses | same | `terms` steps |
| `big-picture` | The story from far above | same | overview, concepts, quiz |
| `walkthrough` | The change, flow by flow | The main flows | flows |
| `review-focus` | The risks: suspected bugs, open questions, what to check before approval | Suspected bugs, traps for the next person who changes the code, docs the code contradicts | 1-2 cards |
| `recap` | "Also changed", the other tests, where to read next, "Other flows" | The other tests, where to read next, "Other flows" | 1-3 cards |

- Every risk goes in `review-focus`. The other chapters say what the code does.
- **Also changed** (PR): one recap card with one `- ` line per mechanical change: the path in backticks and what changed (a rename, formatting, generated code, docs, imports or exports, a boilerplate test, a lockfile). Mechanical changes get no code notes.
- **Other flows**: a recap card with one line per flow that the story plan's `Left out:` names, with its trigger.
- **Once**: say each fact once, in the step where the reader sees it in code. Later steps and chapters build on it.

## Intro

A build-up of short cards, one topic each, that tells the whole story the walkthrough needs. For a PR: the problem, the constraint, the decision, then what the decision means for the code. For a module or question: what the code is for, who uses it, and how it is wired in (the route, job, flag or import that starts it). For a question, the answer comes first. Give a card that draws on the PR, a ticket or a page its `links`.

## Glossary

The glossary defines the domain terms. Order them by dependency: each meaning uses only terms defined above it, or plain words. Group them by concept into small `terms` steps, such as "Stellar basics", then "An Earn action", then "Who pays". Each step's `say` ties its group to the group before. Give a term its identifier in `code` when the code has one.

## Big picture

The story from far above, in this order:

1. The **overview**: one `sequence` step, the map of the walkthrough. Its actors are the groups (the widget, the backend, the vendor, the chain). Each call links to the flow that zooms into it. Leave the overview out when the dive has one flow.
2. **Concepts**: only the abstractions the flows depend on, such as a state machine, the data model, which parts depend on which, or who trusts whom. Each concept is one diagram or one card. A diagram's `say`, or a card's first sentence, states the one question it answers.
3. One quiz.

A diagram tells its story through its diagram notes, which the app reveals one by one. Focus the first note on the entry nodes. Each later note adds the nodes in its `focus`. Nodes that no note has named yet show as ghosts. So each note builds on the one before, and every node is in the `focus` of some note.

## Flows

The walkthrough is one or more flows. A flow is one sequence plus the code behind its messages, in this order:

1. the `flow` step, which draws the main path. Its `say` opens with one clause on where the reader is: how they got here from the flow before, or what starts the first flow.
2. the code steps, in the order of the messages that first link to them,
3. one quiz,
4. the flow's 0-2 edge steps. They come last, so the reader can skip them.

Title a flow with a verb phrase for what it achieves: "Build the unsigned transaction".

## Sequences

The sequences are the spine of the dive: the reader maps each message to the code. A sequence starts where execution starts and follows it to its effect. The overview takes its actors and links from **Big picture**. The rest holds for every sequence.

- **Actors**: An actor is a code unit whose code the walkthrough shows, named by its code name (`RefundStore`, `retryRefund`), or an external system (Postgres, a queue, a vendor API). A pure helper or value object is not an actor: name it in the text of the hop or message.
- **Groups**: An actor's `group` is the deployable app or package that owns it (a service, a library, the database), or `outside` for a system the scope does not own. Keep the actors of one group next to each other. The app draws one band over each run of neighbors in a group.
- **Messages**: One message per call, return, or queued message. Show one pass of a loop. Each message starts from an actor that has control: the one the previous message reached, or a caller still waiting on its call. Use `return` for replies, `error` for failures, and `async` for queued work. An in-process check is a message from an actor to itself. Every message has a message note.
- **Main path**: the path a `flow` step draws. It is the path the change or the question is about (for a module, the usual path). It may be a failure path: when the point of a PR is new failure handling, that handling is the main path, with the rejection as an `error` message.
- **Links**: a message's `step` names the code step of the same flow that shows the code that sends or handles it. In the `flow` step, every changed call (PR) or every call into code in scope (otherwise) links to one. In a PR, only changed messages link. Returns and messages from external systems may have no link. Several messages may link to one code step. Edge messages may link too (**Edge steps**).
- **PR marks**: mark the actors and messages that the PR adds, changes, or removes with `change`, in the flow and in its edge steps.

## Edge steps

An edge step draws one edge case of its flow as a sequence. It starts at the message where the path leaves the main path and ends at the outcome: a status, an error, a retry. Its actors are the flow's actors that its messages use, with the same ids and labels, plus any actors the outline adds for it. The code it touches lives in the flow's code steps: its messages may link to the ones that show the guard.

## Code steps

A code step shows one piece of logic. Its `title` and `say` hold for the whole step. Title the logic: "A fetch failure becomes a NetworkError". Code notes follow execution order and may cross files. Each code note sits on the lines it explains. To point at other lines, give them their own code note.

- **Load-bearing**: put code notes only on load-bearing lines, the lines the story plan's one sentence depends on. In a PR, only new, changed or removed lines qualify. When the order of unchanged checks matters, say it in one sentence in `say`. For a module or question, the lines are on the main path or answer the question. Follow a call into a function when the call is load-bearing, and note a type or constant where the code uses it. Keep every load-bearing code note, however long the step gets.
- **New names**: the story plan's `New names:` line gives the flow that introduces each function, constant or type from the scope. In that flow, the first code note that names it says in a few words what it does. For a name the glossary defines, a short reminder is enough. Other flows use the name without explaining it again. When the name is load-bearing, its own code note comes where execution reaches it, on the line that matters. Example: one code note on the line of `isRawNetworkError` that checks a message against a list of runtime error messages, then one on that list. The other lines of `isRawNetworkError` get no code note.
- **Tests**: put a test's code note right after the code note on the behavior it proves, in the same step, when the test shows something that note does not. List the other tests in a recap card.

## Quizzes

A quiz tests understanding: a consequence, a cause, or the result of a given input, never trivia such as names or line numbers. Earlier steps of the dive contain the answer. Each wrong option is a mistake a smart reader could make, so every option sounds plausible. Keep the options similar in length and form, and make each one whole on its own: the app shuffles them.
