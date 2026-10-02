# Writing

Write every string in **Simplified Technical English** (ASD-STE100): the controlled English of technical manuals. It gives each sentence one reading, so a tired reader understands it the first time.

## Sentences

- **One idea per sentence.** When "and", "but", "which" or "while" joins two ideas, write two sentences.
- **Short sentences.** 20 words or fewer for an instruction, 25 for a description. Most sentences are much shorter.
- **Active voice.** Name who acts: "`RefundJob` retries the call", not "the call is retried".
- **Simple tenses.** Present for how the code works now, past for old behavior, future for what comes next. "Before, every failure waited 60 s."
- **Keep the small words.** Keep the articles, the subject and the verb: "the files that are not saved", not "files not saved".
- **Clear pointers.** "It", "this" and "they" point to one noun. When two nouns could match, repeat the noun.
- **Lists for 3 or more items**, as `- ` lines in a card body. Only a card body shows them as a list.

## Words

- **The common word**: "use", not "utilize". "Start", not "initiate". "Show", not "surface".
- **The verb, not its noun**: "checks the token", not "performs validation of the token".
- **One-word verbs**: "start", not "spin up". "Remove", not "take out".
- **At most 3 nouns in a row.** "Retry delay cap" is fine. For "refund retry delay cap config", write "the setting that caps the retry delay".
- **One name for one thing**: the name that the code and the plan use, in every string. If the code says `Refund`, write "refund", not "reimbursement".
- **Backticks for identifiers** in `say`, `body`, `meaning`, `note`, `text`, `question` and `why`. Titles, labels, `term`, `code` and `summary` show backticks as plain characters, so leave them out there.

## Meaning

- **Concrete over abstract.** Name the file, the function, the field, the value: "`MAX_ATTEMPTS` is 5", not "a limit". "Waits up to 32 s", not "waits a long time".
- **What, then why.** Say what the code does, then why it matters.
- **Facts from sources.** Every fact comes from the code, the diff or a cited page, and that includes causes and motives.
- **Keep the source's certainty.** When the code only suggests a thing, write "may". "May fail" stays "may fail".
- **Plain words only.** Write without filler ("it's worth noting"), stock words (robust, seamless, leverage, crucial), quality claims (powerful, elegant), and decoration (exclamation marks, emojis, bold for stress).

## Limits

The app shows each string in a fixed slot. Keep to these limits:

| Slot | Limit |
|---|---|
| Step `title` | 6 words or fewer, without a colon |
| `say` | 1-3 sentences: the one point of the step |
| Code note `text` | 1-3 sentences |
| Code note `lines` | about 15 lines at most |
| Card `body` | one topic. Past about 6 bullets, split it into two cards |
| Term `meaning` | 1-2 sentences: what it is in this codebase |
| Message `label` | about 30 characters. Put paths and long arguments in the note |
| Message `note` | 1 sentence |
| Diagram `nodes` | 3-12 |
| Quiz `question` | 1 sentence |
| Quiz `why` | 1 sentence per option: why it is right, or why it is wrong |

## Before and after

| Before | After |
|---|---|
| "This robust retry mechanism leverages exponential backoff to seamlessly handle transient failures." | "`nextDelay` doubles the wait cap after each attempt. Retries after an outage do not all hit the gateway at once." |
| "In this step, we'll dive into how the worker has been updated to track attempts!" | "The worker now counts each attempt before it sends the refund." |
| "This fixes all duplicate refunds." | "This stops duplicate refunds from retries. It does not cover refunds that a person starts." |
