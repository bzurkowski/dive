# Writing rules

Every string in a dive follows these rules, written for the reader in story.md. Each sentence says one thing, once, in plain words.

Based on ASD-STE100 Simplified Technical English, as distilled by [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) (MIT). This is a clarity guide, not certified STE.

## Sentences

- One idea per sentence. Split at "and", "but", "which", "while".
- 20 words or fewer for instructions. 25 or fewer for descriptions. Most sentences should be much shorter.
- Active voice. Name who acts: "`RefundJob` retries the call", not "the call is retried". Use passive only when the actor does not matter.
- Simple tenses: present, past, future. "The worker counted the attempt", not "has counted". Keep a compound form only when it carries meaning ("may have failed").
- No semicolons. Write two sentences. An em dash usually hides a second sentence too.
- Keep the small words: articles, subject, verb. "Files that are not saved are lost", not "files not saved lost".
- Make "it", "this" and "they" point to one noun. If two nouns could match, repeat the noun.
- Use a list for 3 or more steps, conditions or items.

## Words

- Use the common word: "use", not "utilize". "Start", not "initiate". "Show", not "surface".
- One name for one thing. Use the same name in every step, note and quiz. If the code says `Refund`, do not also write "reimbursement". Rotated synonyms make the reader ask if these are different things.
- Use the verb, not its noun: "checks the token", not "performs validation of the token".
- No phrasal verbs: "start", not "spin up". "Remove", not "take out". "Read", not "dive into".
- Stack at most 3 nouns. "retry delay cap" is fine. "refund retry delay cap config" is not. Write "the setting that caps the retry delay".
- Define each domain term once, in the glossary. Then use it the same way everywhere.
- Wrap code identifiers in backticks: `nextDelay`, `MAX_ATTEMPTS`.

## Meaning

- Keep the source's certainty. If the code or doc only suggests something, write "may". Do not turn "may fail" into "fails".
- Do not add facts. No invented causes, frequencies or motives. If it is not in the code, the diff or a cited doc, do not write it.
- Clear is the goal, not short. Stop cutting when the sentence has one reading.
- If a sentence says nothing, delete it. Polish does not fix empty content.

## Build on what came before

Every list and every run of steps is a chain. Each point follows from the one before it: the problem, then the constraint, then the decision, then what it means for the code. Each link gives the reader an aha moment. Before you add a point, name the point it follows from. If there is none, move the point to where it follows, or cut it.

## No AI slop

Delete these, or replace them with the fact they hide.

| Pattern | Examples | Write instead |
|---|---|---|
| Stock words | delve, robust, seamless, leverage, crucial, pivotal, comprehensive, streamline, holistic, landscape, realm | the plain word, or nothing |
| Quality claims | powerful, elegant, blazing-fast, significantly improves | the number: "cuts p95 from 800 ms to 120 ms" |
| Hedges and filler | "it's worth noting", "it is important to", "essentially", "in order to" | the claim itself |
| Filler openers | "Let's dive in", "In this step, we will explore" | start with the fact |
| Fake contrast | "not only X but also Y", "it's not just X, it's Y" | "X. It also does Y." |
| Forced triads | "fast, safe, and scalable" when one is true | only what is true |
| Empty summaries | "Overall, this greatly improves the system." | delete, or name the effect |
| Decoration | em-dash chains, emojis, exclamation marks, bold for emphasis | plain sentences |

## The dive voice

Write like the author of the change, reviewing their own PR for a colleague who has already read a lot of code today. Outside a PR, write like the owner of the code, who shows it to a new teammate.

- Concrete over abstract. Name the file, function, field or value: "`MAX_ATTEMPTS` is 5", not "a limit".
- Numbers over adjectives: "waits up to 32 s", not "waits a long time".
- Say what the code does, then why it matters. Never say how good it is.
- Present tense for how the code works now. Past tense for old behavior: "Before, every failure waited 60 s."

## Slot limits

| Slot | Limit |
|---|---|
| Step `title` | 6 words or fewer. A plain noun phrase or statement. No colons, no puns. |
| `say` | 1-3 sentences. The one point of this step. |
| Code note `text` | 1-3 sentences. What this block does, then why it matters. |
| Code note `lines` | About 15 lines at most. |
| Card `body` | One topic per card. Past about 6 bullets or sentences, split the topic into another card. |
| Terms step `terms` | About 2-7. Use as many terms steps as the groups need. |
| Terms step `say` | 1 sentence. |
| Term `meaning` | 1-2 sentences. What it is in this codebase, not in general. |
| `actors` of a sequence, flow, or edge | 30 at most (the build checks). |
| `messages` of a sequence, flow, or edge | No cap. |
| Message `label` | Short: about 30 characters. Put paths and long argument lists in the note. |
| Message `note` | 1 sentence. What happens or why. Never restate the label. |
| Diagram `nodes` | 3-12. |
| Quiz `question` | 1 sentence. |
| Quiz `options` | 3-4. Exactly one correct. No "all of the above". |
| Quiz `why` | 1 sentence per option: why it is right, or the exact reason it is wrong. |

## Before and after

**Code note**
- Before: "This robust retry mechanism leverages exponential backoff to seamlessly handle transient failures, which is crucial for reliability."
- After: "`nextDelay` doubles the wait cap after each attempt and picks a random wait below it. Retries after an outage do not all hit the gateway at once."

**`say`**
- Before: "In this step, we'll dive into how the worker has been updated to track attempts — a key part of the new flow!"
- After: "The worker now counts each attempt before it sends the refund."

**Card**
- Before: "Overall, this PR not only improves reliability but also enhances idempotency, security, and maintainability."
- After: "- Retries stop after 5 attempts.\n- The refund id is the idempotency key. A retry cannot refund twice."

**Term**
- Before: "Idempotency is a fundamental concept in distributed systems whereby an operation can be applied many times without changing the result."
- After: "An id that lets the gateway ignore a refund request it already did."

**Quiz option (distractor)**
- Before: "The server crashes." (nobody picks it, so it tests nothing)
- After: "The worker skips the refund because the attempt count went up." Why: "No. The count only stops retries after 5 attempts."

**Chain of cards**
- Before: "Retries stop after 5 attempts." / "The refund id is the key." / "Waits are random." (three facts in no order)
- After: "Retries flooded the gateway" (the problem) / "A retry could refund twice" (the same retries cause a second problem) / "The decision" (one fix for each problem)

**Certainty**
- Before: "This fixes all duplicate refunds." (the PR only covers retries)
- After: "This stops duplicate refunds from retries. It does not cover refunds started by hand."

## Self-check before you save a part

1. Each sentence holds one idea and fits the word limits in **Sentences**.
2. Active voice, simple tense, no semicolons.
3. One name per concept, the same as in the glossary and the code.
4. No word from the slop table. No hype, no emojis.
5. Every claim traces to the code, the diff or a cited doc. Hedges are kept.
6. Each point in a list or run of steps follows from the one before.
7. Each slot is within its limit.
