# Dive

Dive is an Agent Skill that turns a pull request, a code module, or a question about your codebase into an interactive walkthrough of the real code.

| Big picture | Code walkthrough | Sequence |
| --- | --- | --- |
| ![Dependency diagram](docs/screenshots/diagram.png) | ![Highlighted code with a note](docs/screenshots/code.png) | ![Sequence diagram with a note](docs/screenshots/sequence.png) |

## Table of contents

- [Why](#why)
- [How it works](#how-it-works)
- [What's in a dive](#whats-in-a-dive)
- [Usage](#usage)
- [Installation](#installation)
  - [Claude Code](#claude-code)
  - [Codex and Cursor](#codex-and-cursor)
  - [Other agents](#other-agents)

## Why

Coding agents now write a large share of the code we ship. Changes land faster than we can review them in depth, so we skim, merge, and move on. A diff can look fine at a glance and still hide the details that matter.

Other teams move just as fast. The parts of the system you don't own get harder to follow, and so does any work that crosses team lines. Over time we understand less of our own systems.

Addy Osmani calls this [comprehension debt](https://addyosmani.com/blog/comprehension-debt/), also known as cognitive debt.

Dive helps you pay it down. It walks you through a change or a part of the domain one step at a time, using the real code, until you understand how it works and why it was built that way.

## How it works

Dive tells the story step by step, with the real code, sequence diagrams, a glossary, and short quizzes. To build it, the agent:

1. Works out what you gave it and fetches the pull request, if there is one.
2. Sends out scouts in parallel:
   - one per area of the code, which traces the call chains through it,
   - one for the context: the PR description and comments, commits, linked issues, and docs,
   - one for Notion, Confluence, Jira, or Linear, if you have them connected.
3. Joins the call chains into flows and fixes the whole story before any prose: each flow's sequence, the code behind each message, and the edge cases.
4. Hands each flow, and each group of the other chapters, to its own writer, in parallel.
5. Checks every code reference and link against the real code and builds the page.

## What's in a dive

Every dive follows the same outline:

1. **Intro** - the problem and the decision, with links to the PR, tickets, and docs. For a module or a question: what the code is for and who uses it, or the answer
2. **Glossary** - the terms the rest of the dive uses, each one building on the ones before
3. **Big picture** - the story from far above: a map of the flows, then the ideas they depend on
4. **Walkthrough** - one or more flows. Each flow is a sequence diagram of the normal path, then the code behind its messages, then optional edge cases
5. **Review focus** - suspected bugs and risks: what to check before you approve a PR, or traps to know before you change the code
6. **Recap** - what to remember, other changed files (PR), where to read next, and the flows the dive left out

The writing is meant to be easy to read: short sentences, one name for each concept, and nothing that isn't backed by the code or a linked doc.

## Usage

```
/dive 1234                                    # a pull request number
/dive https://github.com/acme/shop/pull/1234  # a pull request URL
/dive src/payments                            # a module
/dive how do refunds get retried?             # a question
```

The dive is written to `docs/dives/<slug>/index.html` and opens in your browser when it's ready. Nothing is committed. For pull requests, your working tree and current branch are left alone.

## Installation

### Claude Code

```
/plugin marketplace add bzurkowski/dive
/plugin install dive@dive
```

### Codex and Cursor

This repo is also a Codex plugin (`.codex-plugin/`, marketplace in `.agents/plugins/`) and a Cursor plugin (`.cursor-plugin/`). Add `bzurkowski/dive` as a plugin source in your agent.

### Other agents

Any agent that reads Agent Skills:

```
npx skills add bzurkowski/dive
```

Or copy `skills/dive/` into your agent's skills directory.

Requirements: `git` and `python3`. `gh` is optional.
