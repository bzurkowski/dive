# Plan

The plan is the outline of the dive. You write it in step 2, before any writer starts. Each writer works only from the plan and the code, and no writer sees the work of the others. So the plan holds all that the writers must agree on: the flows and their order, the actors that more than one flow shows, and the domain terms.

## Read the scope

Read only as deep as you need to name the flows. The writers read the code in depth.

- **PR**: the description, `git diff --stat <base> <head>`, and the hunk headers: `git diff -U0 <base> <head> | grep -E '^(\+\+\+|@@)'`.
- **Module**: the files under the path, and their entry points: routes, handlers, jobs, consumers, commands, exports.
- **Question**: the files that your search found.

## Pick the flows

A **flow** is one trigger and the path that it runs, from the trigger to its effect. A trigger is a user action, a job, a webhook, a consumer, or a CI event.

- Pick at most about 5 flows: the ones that matter most. In a PR, pick the flows that run through changed code. A simple PR or module has one flow.
- Each flow is the share of one writer. When one path is much longer than the others, split it where it stops anyway: at a queue, a job, or a wait for the user. Each part becomes its own flow.
- Put the flows in the order the reader should meet them. This order gives each flow its number, from 1.

## plan.md

```md
# <title>
<summary, 1-2 sentences>

- Story: <the dive in one sentence>
- Level: <new or familiar> - <the reason>
- Terms: <the domain terms that the glossary defines>
- Also changed: <PR only: each mechanical change, as `path` - what changed>
- Left out: <each flow you did not pick, with its trigger>

## Actors
- <id> <label> (<group>)

## flow <id>: <title>
Trigger: <the trigger> - <path>:<line>
Effect: <where the flow ends>
Path: <the files it runs through, in order>
```

- **Terms** are the domain words that every writer uses for the same things.
- **Also changed** lists the changes with no logic in them: renames, formatting, generated code, imports, lockfiles. The intro writer puts them in the recap.
- **Actors** lists the actors that more than one flow shows, so that every writer draws them the same way. An actor's `id` is a short lowercase word. Its `label` is the code name or the name of the external system. Its `group` is the app or package that owns it, or `outside`.
- A flow's **id** is lowercase words joined by dashes, such as `send-refund`. **Path** is the writer's head start. The writer follows the code wherever it goes.

## dive.json

```json
{ "title": "<title>", "summary": "<summary>",
  "source": { "kind": "<pr, module or question>", "ref": "<the argument as given>", "url": "<the PR URL>" },
  "chapters": [] }
```

Leave out `url` outside a PR. The build fills in the chapters from the part files, the git fields, and the links of the cards.
