# Plan

You fix the frame of the dive before any writer starts. The writers run at the same time and each sees only `plan.md`, so the plan holds everything they share: the flows, the actors, and the names and terms that more than one of them uses. The writers read the code, so read the scope only as deep as naming its flows needs.

## Reading the scope

- PR: the PR text from prep, `git diff --stat <base> <head>`, and the hunk headers, `git diff -U0 <base> <head> | grep -E '^(\+\+\+|@@)'`. Read a hunk only when its file and header leave its role unclear.
- module: the areas, then their entry points: routes, handlers, jobs, consumers, commands, exports.
- question: the files your search found in prep.

## Picking flows

A flow is one trigger and the path it runs, from the trigger to its effect. A trigger is a user action, a job, a webhook, a consumer, a CI event. A simple PR or module has one flow.

- PR: keep the flows that run through changed code.
- An edge case with its own trigger, such as a recovery job or a retry consumer, is a flow when it is central to the scope.
- Keep about 5 flows, the ones that matter most. Put each other flow, with its trigger, in Left out.
- Each flow is one writer's share. When one path runs much longer than the others, split it at a **stop**, and only there: a wait for the user (signing), an async hop to a queue or a job, or a handoff with a persisted status. Each part is its own flow.

## Plan format

```md
# <dive title>
<summary, 1-2 short sentences>
PR: <url> · base <sha> · head <sha>

## Story plan
- Change: <the story in one sentence>
- Level: <new or familiar> - <the reason>
- Terms: <Term>, <Term>
- New names: `<name>`, `<name>` → `<flow id>`
- Also changed: `<path>` <what changed>
- Left out: <what> - <why>

## Actors
- <id> <label> (<group>, <change>)

## flow <id>: <title>
Trigger: <trigger> - <path>:<line>
Effect: <the effect the flow ends at>
Path: <path>, <path>
```

- Lines 1 and 2 become `title` and `summary` in `dive.json`. Line 3 is for a PR only, with the shas that prep printed.
- `Change:` is for a PR. A module takes `Does:`, a question `Answer:`.
- `Level:` the level and its reason from prep.
- `Terms:` the domain terms that the glossary defines and every writer uses.
- `New names:` the code names (functions, constants, types) that more than one flow shows, each with the first flow that shows it. That flow explains the name, and the others use it.
- `Also changed:` (PR) one line per mechanical change: a rename, formatting, generated code, docs, imports or exports, a boilerplate test, a lockfile.
- `Left out:` one line per group of dropped items, with why, and one line per flow you cut, with its trigger.
- `## Actors` holds the actors that more than one flow shows, and at least one actor of each group the flows cross. An actor's `id` is a short lowercase word, its `label` the code name or the name of the external system. Its `group` is the deployable app or package that owns it, or `outside`. Its `change` is `added`, `changed` or `removed`, in a PR only: leave it out for an unchanged actor. The writers add the actors only their flow shows.
- In a flow, `Path:` lists the files the flow runs through, in order. It is the writer's head start: the writer follows the code wherever it goes.
- Order the flows as the reader should meet them. The order gives each flow its number, from 1.

## The dive.json frame

```json
{ "title": "<line 1 of the plan>", "summary": "<line 2 of the plan>",
  "source": { "kind": "<kind>", "ref": "<the argument as given>", "url": "<the PR URL>" },
  "chapters": [] }
```

Write `docs/dives/<slug>/dive.json` as strict JSON. Leave out `url` outside a PR. The build fills `chapters` from the part files, `repo`, `base` and `head` from git, and `links` from the cards' links.

## Checklist

The plan is done when every line holds for `docs/dives/<slug>/plan.md` and `dive.json`.

- PR: every changed file is on a flow's `Path:`, on `Also changed:`, or in `Left out:` with its reason.
- Module or question: every area that prep printed has a file on a flow's `Path:`, or is in `Left out:` with its reason.
- Every flow has its `Trigger:` with the entry line, its `Effect:` and its `Path:`. Its id is lowercase letters and digits in words joined by single dashes, and no two flows share one.
- Every flow you cut is in `Left out:` with its trigger.
- In `## Actors`, each group's actors are next to each other, and `change` marks appear only in a PR.
- `dive.json` holds the frame.
