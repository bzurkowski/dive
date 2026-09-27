---
name: dive
description: Builds a dive, an interactive story-driven walkthrough that explains a pull request, a code module, a domain question, or a knowledge-base page (Notion, Confluence) to a developer. Use when the user wants to dive into, walk through, or get onboarded onto a PR, a path in the codebase, how something in this repo works, or a doc page. One argument - a PR number or URL, a path, a question, or a page URL.
---

# Dive

A dive tells the story of a PR, module, or domain in small steps, so a tired developer understands it in about 10 minutes. The output is one self-contained file: `docs/dives/<slug>/index.html`.

You orchestrate. Scouts discover in parallel, you outline the story, writers fill chapters in parallel, and a script builds the page. Keep your own context small: read the scouts' notes, not the whole codebase.

`<skill>` is the directory of this file. Run all commands from the repository root. Scouts and writers are subagents that inherit your model. If you cannot spawn subagents, do each scout and writer task yourself, one after another.

## 1. Prep

Classify the argument:

| Argument | Kind | Slug |
|---|---|---|
| PR number or PR URL | `pr` | `pr-<n>-<2-4 title words>` |
| path that exists in the repo | `module` | `module-<path, / as ->` |
| knowledge page URL (Notion, Confluence, Google Docs, …) | `doc` | `doc-<2-4 title words>` |
| anything else | `question` | `q-<2-4 words>` |

Delete `docs/dives/<slug>/` if it exists: a rerun starts fresh. Then, by kind:

- `pr`: read the title and description with `gh pr view <n> --json title,body,url`. Without `gh`, use `curl -s https://api.github.com/repos/<owner>/<repo>/pulls/<n>` (add `-H "Authorization: Bearer $GITHUB_TOKEN"` when it is set). Then run `python3 <skill>/scripts/dive.py prep docs/dives/<slug> --pr <n>`. It fetches the PR into a side ref, writes `diff.json`, and prints `base=`, `head=`, and the changed areas. Read PR code only through `git show <head>:<path>` and `git diff <base> <head> -- <path>`. The user's working tree and branch stay untouched.
- `module`: measure it with `git ls-files <path> | xargs wc -l`.
- `question`: search the code for the question's key terms (identifiers, routes, tables, messages) until you can name the files that answer it.
- `doc`: read the page with a connected knowledge tool. If no connected tool can read it, stop and tell the user which connector the page needs. Then find the code the page describes.

Split the scope into **areas**: groups of related files, about 10 files or 400 changed lines each. Every changed file (`pr`) or file in scope belongs to exactly one area.

## 2. Discover (parallel)

In one message, spawn all scouts:

- one **area scout** per area,
- one **context scout**,
- one **knowledge scout**, only when a knowledge tool (Notion, Confluence, Google Drive, Jira, Linear, …) is connected.

Fill in each brief from [references/scouts.md](references/scouts.md). Scouts write `docs/dives/<slug>/notes/<name>.md`. Wait for all of them.

## 3. Outline (you)

Read every note. Write `docs/dives/<slug>/outline.md` and `docs/dives/<slug>/dive.json` (title, summary, source, `"chapters": []`) as [references/story.md](references/story.md) and [references/format.md](references/format.md) describe. The outline is done when every item under Flow, Edge cases, and Mechanical in every note has a place: a step, or the "Also changed" card.

## 4. Write (parallel)

In one message, spawn one **writer** per chapter in the outline. Give a chapter with more than 4 steps to two or more writers, about 4 steps each, each with its own part file (`parts/<id>.1.json`, `parts/<id>.2.json`). Writer brief:

> You write chapter `<id>` of a dive about <argument>. Read `<skill>/references/format.md`, `<skill>/references/story.md`, and `<skill>/references/writing.md`. Then read `docs/dives/<slug>/outline.md` and the notes it cites for your steps. Write `docs/dives/<slug>/parts/<id>.json` (or `<id>.<n>.json`) with <all steps | steps x-y> of your chapter. Take line numbers from the code itself: `git show <head>:<path> | cat -n` for new lines, `git show <base>:<path> | cat -n` for deleted lines, `cat -n <path>` outside a PR. Every sentence follows writing.md. Do not run dive.py: the build validates. Return one line: the number of steps you wrote.

## 5. Build

Run `python3 <skill>/scripts/dive.py build docs/dives/<slug>`. It merges the parts into `dive.json`, checks every step and line range, embeds the real code, writes `index.html`, and prints the word count, code-note count, and estimated reading time.

On errors, fix the part file (or `dive.json` after a successful build, which deletes the parts), then build again.

Open the page: `open docs/dives/<slug>/index.html` on macOS, `xdg-open` on Linux. Give the user the path and one sentence about the story. Leave all files uncommitted.
