# Dive

Dive is an Agent Skill. It turns a pull request, a module, or a question about your code into an interactive walkthrough of the real code.

| Big picture | Code with notes | Sequence diagram |
| --- | --- | --- |
| ![A diagram of where the retry errors of Ky come from](docs/screenshots/diagram.png) | ![Removed and added lines of a pull request, with a note on each change](docs/screenshots/code.png) | ![A sequence diagram of a failed fetch, with a note on the changed message](docs/screenshots/sequence.png) |

## Why

Coding agents write more of our code every day. Changes land faster than we can review them, so we skim them and merge. The code that other teams own changes just as fast, and it gets harder to follow. Over time, we understand less of our own systems. Addy Osmani calls this [comprehension debt](https://addyosmani.com/blog/comprehension-debt/).

Dive helps you pay it down. It walks you through a change or a part of the code, one small step at a time. Each step shows the real lines of code. At the end, you know how the code works and why it was built that way.

## Install

In Claude Code:

```
/plugin marketplace add bzurkowski/dive
/plugin install dive@dive
```

In Codex or Cursor, add `bzurkowski/dive` as a plugin source. The repository has a plugin for each of them.

In any other agent that reads Agent Skills:

```
npx skills add bzurkowski/dive
```

You can also copy `skills/dive/` into the skills directory of your agent.

Dive needs `git` and `python3`. `gh` is optional. Dive uses it to read the description and the comments of a pull request.

## Usage

```
/dive 1234                                    # a pull request number
/dive https://github.com/acme/shop/pull/1234  # a pull request URL
/dive src/payments                            # a module
/dive how do refunds get retried?             # a question
/dive src/payments I am new to payments       # how well you know the code
```

Dive writes the walkthrough to `docs/dives/<slug>/index.html` and opens it in your browser. It commits nothing. For a pull request, it does not change your branch or your working tree.

Dive writes for your level. If you are new to the code, the dive adds a primer and defines every term of the domain. If you know the code, it defines only the new terms. Say your level as in the last example, or Dive counts your commits in that code from the last year.

## What is in a dive

| Chapter | What it shows |
| --- | --- |
| Intro | Why the code exists. For a pull request, the problem and the decision. |
| Glossary | The terms of the domain. You can search them from every step. |
| Big picture | A map of the flows, and the concepts that they depend on. |
| Walkthrough | Each flow as a sequence diagram. Each message links to the code behind it. |
| Review focus | The risks, such as suspected bugs, traps and open questions. |

Short quizzes check that you understand the code. On every step, the Ask button opens Claude Code, Cursor or Codex with a prompt about that step. It can also copy the prompt for any other chat.

## How it works

1. The agent reads the scope and plans the key flows of the business logic.
2. Writer subagents run in parallel, one for each chapter and one for each flow. Each flow writer traces its flow through the code. The intro writer also searches connected tools, such as Notion or Slack.
3. `dive.py` checks each step and each line range against the code, and builds the page.
