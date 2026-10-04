# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two co-primary readers. Neither wins by default; the dive's level (`new` or `familiar`) absorbs the difference.

- **Reviewer:** an engineer reviewing a pull request, often agent-written, who has to understand it well enough to approve it rather than skim and merge.
- **Newcomer:** an engineer working in a module or another team's domain they don't own, who needs to learn how it works and why it was built that way.

Usually the reader is whoever ran `/dive`. Sometimes it is a teammate: a dive gets shared as a supplement to a PR review or sent as a file. A shared reader may not have the agent, the repo checked out, or the context the author had.

## Product Purpose

Dive pays down comprehension debt. Agents write code faster than people can review it, and the parts of a system nobody owns get harder to follow. Dive turns a pull request, a module, or a question about the code into an interactive walkthrough of the real code, one step at a time.

It succeeds when the reader understands how the change or domain works and why it was built that way, from the dive alone.

## Positioning

The walkthrough is built from traces of the real code, not a summary of it. Subagents scout the scope, the orchestrator picks the key business flows, tracers follow each flow end to end, and writers turn the traces into steps. Each flow is a sequence diagram whose messages link to the exact lines behind them. Short quizzes check understanding along the way.

## Operating Context

- Invoked from a coding agent: `/dive <PR number or URL | path | question> [how well I know the domain]`. Runs in Claude Code, Codex, Cursor, or any agent that reads Agent Skills.
- Output is one self-contained, offline `docs/dives/<slug>/index.html` that opens in the browser when it's ready. Nothing is committed, and for PRs the working tree and branch are left alone.
- Read next to the PR or the code itself. An Ask button on every step opens Claude Code, Cursor, or Codex with a prompt about that step, or copies the prompt.

## Capabilities and Constraints

- Chapters, in fixed order: intro, glossary, big picture, walkthrough, review focus, recap. Empty chapters are left out.
- Step kinds: card, terms, code, sequence/flow/edge, diagram, quiz. A searchable glossary drawer is available on every screen.
- The data contract is `app/src/types.ts`. Agents write `dive.json`, and `dive.py build` validates it and bakes it into the template.
- A single file that works offline: fonts and data are bundled and nothing is fetched at runtime. It has to work as an attachment, opened with no server.
- Simple and fast is the product mantra. Short instructions, parallel subagents, one stdlib script, no build pipeline when the skill runs.

## Brand Commitments

- Name: Dive. A walkthrough is "a dive".
- Voice: plain, short sentences, concrete steps. Notes read like PR self-review comments.

## Evidence on Hand

- `example/`: a real dive of sindresorhus/ky PR #842 ("Add NetworkError and tighten retry logic"), with its notes, outline, and built `index.html`.
- `docs/screenshots/`: big picture diagram, code walkthrough, and sequence screenshots used in the README.
- `app/public/dive.json`: a fictional dev fixture (acme/shop PR #42). It is not evidence.
- No users, testimonials, metrics, or adoption numbers. Don't invent any.

## Product Principles

1. **Understanding over coverage.** A dive is done when the reader gets it, not when every file is mentioned.
2. **Real code, always.** Every claim points to the lines behind it.
3. **Small steps.** One idea per step, revealed in order.
4. **Stands alone.** A teammate who gets the file without the repo or the agent can still follow it.
5. **Simple and fast.** If it's slow or long, people won't use it.

## Accessibility & Inclusion

Best effort, no formal standard. Keep the care already in the app: Atkinson Hyperlegible fonts, ARIA labels, keyboard navigation, reduced-motion handling, light and dark themes.
