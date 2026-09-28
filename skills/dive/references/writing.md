# Writing rules

Write every string in ASD-STE100 Simplified Technical English, for the reader and in the voice that story.md defines. The rules adapt [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) (MIT) to a dive.

## Sentences

- One idea per sentence. Split a sentence whose clauses are joined by "and", "but", "which", "while", a semicolon or a dash.
- 25 words or fewer. Most sentences are much shorter.
- Active voice. Name who acts: "`RefundJob` retries the call", not "the call is retried". Use passive only when the actor does not matter.
- Simple tenses: present, past, future. "The worker counted the attempt", not "has counted". Keep a compound form only when it carries meaning ("may have failed").
- Keep the small words: articles, subject, verb. "Files that are not saved are lost", not "files not saved lost".
- Make "it", "this" and "they" point to one noun. If two nouns could match, repeat the noun.
- Write 3 or more items as `- ` lines in a card `body`. Only a card body renders them as a list, and `1.` lines are not a list. Separate paragraphs in a body with a blank line: lines without one between them join into one paragraph. In every other field, a newline shows as a space, so write the items as sentences.

## Words

- Use the common word: "use", not "utilize". "Start", not "initiate". "Show", not "surface".
- Use the one-word verb: "start", not "spin up". "Remove", not "take out". "Read", not "dive into".
- Use the verb, not its noun: "checks the token", not "performs validation of the token".
- Stack at most 3 nouns. "retry delay cap" is fine. "refund retry delay cap config" is not. Write "the setting that caps the retry delay".
- One name for one thing: the name that the code and the outline (its glossary section and New names) use, in every string. If the code says `Refund`, write "refund", not "reimbursement".
- Wrap code identifiers in backticks in `say`, `body`, `meaning`, `note`, `text`, `question` and `why`: they render as code there. Titles, labels, `term`, `code` and `summary` show backticks as literal characters, so write identifiers there without them.

## Meaning

- Every fact comes from the code, the diff or a cited doc, including causes, frequencies and motives.
- Keep the source's certainty. When the code or doc only suggests something, write "may". "May fail" stays "may fail".
- Aim for one reading, not the fewest words. Stop cutting when the sentence has one reading.

## Build-up

Every list, every run of diagram notes and every run of steps is a build-up. Each point follows from the one before it: the problem, then the constraint, then the decision, then what it means for the code. Each point gives the reader a small aha. Before you add a point, name the point it follows from. If there is none, move the point to where it follows, or cut it.

## Slot limits

| Slot | Limit |
|---|---|
| Step `title` | 6 words or fewer, in plain words, without a colon. |
| `say` | 1-3 sentences. The one point of this step. |
| Code note `text` | 1-3 sentences. |
| Code note `lines` | About 15 lines at most. |
| Card `body` | One topic per card. Past about 6 bullets or sentences, split the topic into another card. The "Also changed" card is the exception: it lists every path. |
| Terms step `terms` | About 2-7. Use as many terms steps as the groups need. |
| Terms step `say` | 1 sentence. |
| Term `meaning` | 1-2 sentences. What it is in this codebase, not in general. |
| Message `label` | About 30 characters. Put paths and long argument lists in the message note. |
| Message `note` | 1 sentence. What happens or why, beyond what the label says. |
| Diagram `nodes` | 3-12. |
| Quiz `question` | 1 sentence. |
| Quiz `why` | 1 sentence per option: why it is right, or the exact reason it is wrong. |

## Before and after

| Slot | Before | After |
|---|---|---|
| Code note | "This robust retry mechanism leverages exponential backoff to seamlessly handle transient failures, which is crucial for reliability." | "`nextDelay` doubles the wait cap after each attempt and picks a random wait below it. Retries after an outage do not all hit the gateway at once." |
| `say` | "In this step, we'll dive into how the worker has been updated to track attempts — a key part of the new flow!" | "The worker now counts each attempt before it sends the refund." |
| Card | "Overall, this PR not only improves reliability but also enhances idempotency, security, and maintainability." | "- Retries stop after 5 attempts.\n- The refund id is the idempotency key. A retry cannot refund twice." |
| Term | "Idempotency is a fundamental concept in distributed systems whereby an operation can be applied many times without changing the result." | "An id that lets the gateway ignore a refund request it already did." |
| Quiz option (distractor) | "The server crashes." (nobody picks it, so it tests nothing) | "The worker skips the refund because the attempt count went up." Why: "No. The count only stops retries after 5 attempts." |
| Build-up of cards | "Retries stop after 5 attempts." / "The refund id is the key." / "Waits are random." (three facts in no order) | "Retries flooded the gateway" (the problem) / "A retry could refund twice" (the same retries cause a second problem) / "The decision" (one fix for each problem) |
| Certainty | "This fixes all duplicate refunds." (the PR only covers retries) | "This stops duplicate refunds from retries. It does not cover refunds started by hand." |

## Self-check

Before you save a part, check every string in it against **Sentences**, **Words**, **Meaning**, **Build-up** and **Slot limits**. Then scan it for the patterns below, and replace each with what its first column says.

| Write instead | Pattern | Examples |
|---|---|---|
| the plain word, or nothing | Stock words | delve, robust, seamless, leverage, crucial, pivotal, comprehensive, streamline, holistic, landscape, realm |
| the number: "cuts p95 from 800 ms to 120 ms" | Quality claims | powerful, elegant, blazing-fast, significantly improves |
| the claim itself | Hedges and filler | "it's worth noting", "it is important to", "essentially", "in order to" |
| the fact, first | Filler openers | "Let's dive in", "In this step, we will explore" |
| "X. It also does Y." | Fake contrast | "not only X but also Y", "it's not just X, it's Y" |
| only what is true | Forced triads | "fast, safe, and scalable" when one is true |
| the effect, or nothing | Empty summaries | "Overall, this greatly improves the system." |
| plain sentences | Decoration | em-dash chains, emojis, exclamation marks, bold for emphasis |
