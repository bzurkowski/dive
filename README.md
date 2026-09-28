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

1. Works out what you gave it, fetches the pull request if there is one, and counts your commits in that code to judge how new you are to it.
2. Splits the code into areas along its directories, then sends out scouts in parallel. For a pull request, they read the code at the PR's commits, not in your working tree:
   - one per area, which maps the entry points and call chains in it,
   - one for the context: the PR description, comments and reviews, commits, linked issues, docs, and tests,
   - one for Notion, Confluence, Google Drive, Jira, or Linear, if you have them connected.
3. Picks the flows from the scouts' notes: one per trigger, up to about five, the ones that matter most.
4. Sends one tracer per flow, in parallel. Each follows its flow through the code from the trigger to the effect, across areas, and corrects the scouts' notes where the code disagrees.
5. Fixes the whole story before any prose: each flow's sequence, the code behind each message, and the edge cases. Then it checks that every hop, edge case, and risk the scouts and tracers found has a place, and that nothing in the plan would fail the build.
6. Hands each flow, and each group of the other chapters, to its own writer, in parallel.
7. Checks every code reference and link against the real code and builds the page.

## What's in a dive

Every dive follows the same outline:

1. **Intro** - the problem, the constraint, and the decision, with links to the PR, tickets, and docs. For a module: what the code is for, who uses it, and what starts it. For a question: the answer first
2. **Glossary** - the terms the rest of the dive uses, each one building on the ones before. If you are new to the domain, it opens with a primer and defines every term
3. **Big picture** - the story from far above: a map of the flows, then the ideas they depend on
4. **Walkthrough** - up to about five flows. Each flow is a sequence diagram of the main path, then the code behind its messages, a quiz, then up to two edge cases
5. **Review focus** - 1-2 cards of suspected bugs, risks, and open questions: what to check before you approve a PR, or traps to know before you change the code
6. **Recap** - other changed files (PR), the tests the walkthrough did not show, where to read next, and the flows the dive left out

The writing is meant to be easy to read: short sentences, one name for each concept, and nothing that isn't backed by the code or a linked doc.

## Usage

```
/dive 1234                                    # a pull request number
/dive https://github.com/acme/shop/pull/1234  # a pull request URL
/dive src/payments                            # a module
/dive how do refunds get retried?             # a question
/dive src/payments I'm new to payments        # say how well you know the domain
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
