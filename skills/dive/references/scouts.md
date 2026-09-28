# Scout briefs

Fill in the `<placeholders>` and use the brief as the subagent prompt. Every scout writes to `docs/dives/<slug>/notes/` and reads code at head: `git show <head>:<path>` and `git diff <base> <head> -- <path>` for a PR, the working tree otherwise. Scouts only read code; they never check out branches or edit files.

## Area scout

> You are a scout for a dive: a walkthrough that explains <argument> to a developer. Your area: <paths>. <PR only: base=<base> head=<head>.>
> Read every file in your area and, for a PR, its diff. Follow calls out of the area only as far as the flow needs.
> Tag each Flow item with its layer (`type`, `model`, `migration`, `service`, `flow`) and `core` when the reader needs it to understand the change (PR) or the main flow (module, question), or `detail` when the story can live without it (internals of vendored or inlined code that the scope does not use, and in a PR, unchanged code shown only for context).
> Edge cases are behavior the code was built to have for failures, limits, and odd inputs. Suspected bugs and risks go under Risks and open questions.
> Write `docs/dives/<slug>/notes/<area-name>.md` in the notes format below. You are done when every changed hunk (PR) or every file (otherwise) in your area appears under Flow, Edge cases, or Mechanical.
> Return 3 lines: what the area does, the most important change or idea, the biggest risk.

## Context scout

> You collect the why behind <argument>. Read:
> - PR: the description and comments (`gh pr view <n> --comments`, or the API `repos/<repo>/pulls/<n>` and `repos/<repo>/issues/<n>/comments`), commit messages (`git log --format='%h %s%n%b' <base>..<head>`), linked issues and tickets, and the changed tests.
> - Otherwise: recent history of <paths> (`git log -n 20 --format='%h %s' -- <paths>`), READMEs, ADRs and docs in the repo that use the key terms, and the tests.
>
> Write `docs/dives/<slug>/notes/context.md` with these headings: Goal, Decisions (each with its source), Linked (issues, tickets, pages, with URLs), Tests (the behavior they pin), Open questions.
> Return 3 lines: the goal, the key decision, the main open question.

## Knowledge scout

> You search the connected knowledge tools (<tool names>) for pages about <argument>. Search with: <PR title, ticket ids, key terms>. Read at most the 5 most relevant pages.
> Write `docs/dives/<slug>/notes/knowledge.md`: for each page, its title, URL, and what matters for the code: decisions, requirements, configuration, and anything the code contradicts. Write "No relevant pages." when nothing matches.
> Return 3 lines: the pages found and the most useful fact.

## Notes format

```md
# <area name>
Purpose: <one sentence>

## Terms
- <Term> (`<identifier>`): <one-sentence meaning>

## Entry points
- <path>:<line> <who calls in, and when>

## Flow
1. [<layer>, <core|detail>] <path>:<start>-<end> <what happens, and why>

## Edge cases
- <path>:<start>-<end> <condition> -> <result>

## Mechanical
- <path> <rename | formatting | generated | boilerplate test | lockfile>

## Risks and open questions
- <one line each>
```

Line numbers are head (new-file) numbers. Mark deleted lines as `old <path>:<start>-<end>`.
