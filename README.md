# Dive

Dive is an Agent Skill that turns a pull request, a code module, a question about your codebase, or a knowledge-base page into an interactive walkthrough you can read in about ten minutes.

See an [example dive](examples/pr-842-network-error-retry) into [sindresorhus/ky#842](https://github.com/sindresorhus/ky/pull/842).

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

Dive tells the story step by step, with the real code, diagrams, a glossary, and short quizzes. To build it, the agent:

1. Works out what you gave it and fetches the pull request, if there is one.
2. Sends out scouts in parallel:
   - one per area of the code,
   - one for the context: the PR description and comments, commits, linked issues, and docs,
   - one for Notion, Confluence, Jira, or Linear, if you have them connected.
3. Outlines the story from the scouts' notes.
4. Hands each chapter to its own writer, in parallel.
5. Checks every code reference against the real code and builds the page. For pull requests, it also checks that every changed hunk is explained.

## What's in a dive

Every dive follows the same outline:

1. **Why** - the problem and the decision, with links to the PR, tickets, and docs
2. **Glossary** - the terms the rest of the dive uses
3. **Big picture** - the main parts and how they connect
4. **Happy path** - the normal flow, in execution order
5. **Edge cases** - failures, limits, and unusual inputs
6. **Review focus** - what to check before you approve (pull requests only)
7. **Recap** - what to remember, plus a list of other changed files

The writing is meant to be easy to read: short sentences, one name for each concept, and nothing that isn't backed by the code or a linked doc.

## Usage

```
/dive 1234                                    # a pull request number
/dive https://github.com/acme/shop/pull/1234  # a pull request URL
/dive src/payments                            # a module
/dive how do refunds get retried?             # a question
/dive https://www.notion.so/acme/Refunds-123  # a knowledge page (needs its connector)
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
