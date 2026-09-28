---
name: dive
description: Builds a dive, an interactive story-driven walkthrough that explains a pull request, a code module, a domain question, or a knowledge-base page (Notion, Confluence) to a developer. Use when the user wants to dive into, walk through, or get onboarded onto a PR, a path in the codebase, how something in this repo works, or a doc page. One argument - a PR number or URL, a path, a question, or a page URL.
---

# Dive

A dive tells the story of a PR, module, or domain in small steps, so a tired developer understands it in about 10 minutes. The output is one self-contained file: `docs/dives/<slug>/index.html`.

You orchestrate. Scouts discover in parallel, you outline the story, writers fill chapters in parallel, a script builds the page, and an editor cuts what the story does not need. Keep your own context small: read the scouts' notes, not the whole codebase.

`<skill>` is the directory of this file. Run all commands from the repository root. Scouts, writers, and the editor are subagents that inherit your model. If you cannot spawn subagents, do each scout, writer, and editor task yourself, one after another.

## 1. Prep

The argument may end with words about how well the user knows the domain, such as "I'm new to payments" or "I know payments". Set them aside: they set the level below. Classify the rest:

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

Find the reader's **level**. Pick 1-3 directories that hold the domain of the core areas, such as `services/payments`. Run `python3 <skill>/scripts/dive.py level <dir>... --rev <base>` (without `--rev` outside a PR). It prints `level=` (`new` or `familiar`) and `reason=`. When the argument said how well the user knows the domain, use that level instead, with the user's words as the reason.

## 2. Discover (parallel)

In one message, spawn all scouts:

- one **area scout** per area,
- one **context scout**,
- one **knowledge scout**, only when a knowledge tool (Notion, Confluence, Google Drive, Jira, Linear, …) is connected.

Fill in each brief from [references/scouts.md](references/scouts.md). Scouts write `docs/dives/<slug>/notes/<name>.md`. Wait for all of them.

## 3. Outline (you)

Read every note: its Terms, its Flow items tagged `[<layer>, <core|detail>]`, and the context. Think how to explain the change most clearly to a human: which layers or regions, in what order, and how few steps reveal the important parts.

Write `docs/dives/<slug>/outline.md`, its `## Story plan` first, before any step. Write `docs/dives/<slug>/dive.json` (title, summary, source, `"chapters": []`). Follow [references/story.md](references/story.md) and [references/format.md](references/format.md). The outline is done when every step serves the story plan, and every Flow, Edge cases, and Mechanical item in the notes is in a step, in "Also changed", or in the plan's Left out list.

## 4. Write (parallel)

In one message, spawn one **writer** per chapter in the outline. Give a chapter with more than 4 steps to two or more writers, about 4 steps each, each with its own part file (`parts/<id>.1.json`, `parts/<id>.2.json`). Writer brief:

> You write chapter `<id>` of a dive about <argument>. Read `<skill>/references/format.md`, `<skill>/references/story.md`, and `<skill>/references/writing.md`. Then read `docs/dives/<slug>/outline.md` and the notes it cites for your steps. Follow its story plan. Write each note as what the author would tell a reviewer about those lines. Write `docs/dives/<slug>/parts/<id>.json` (or `<id>.<n>.json`) with <all steps | steps x-y> of your chapter. Take line numbers from the code itself: `git show <head>:<path> | cat -n` for new lines, `git show <base>:<path> | cat -n` for deleted lines, `cat -n <path>` outside a PR. Every sentence follows writing.md. Do not run dive.py: the build validates. Return one line: the number of steps you wrote.

## 5. Build

Run `python3 <skill>/scripts/dive.py build docs/dives/<slug>`. It merges the parts into `dive.json`, checks every step and line range, embeds the real code, writes `index.html`, and prints the word count, code-note count, and estimated reading time.

On errors, fix the part file (or `dive.json` after a successful build, which deletes the parts), then build again.

## 6. Edit

Spawn one **editor** subagent with a fresh context. Editor brief:

> You edit a dive about <argument> as a first-time reader. Read `<skill>/references/story.md` and `<skill>/references/writing.md`, the story plan in `docs/dives/<slug>/outline.md`, and `docs/dives/<slug>/dive.json`. The last build printed: <its Reading line>.
> Delete or merge steps and notes that break the importance rule in story.md: notes on unchanged code, trivia, repeats across chapters, test notes that only repeat, suspected bugs outside `review-focus`. Move a fact to the step where it belongs when needed. Check the soft budget in story.md against the build output. Do not add new facts. Do not cut a detail the reader needs to understand the change.
> Edit `dive.json` (the parts are already merged), run `python3 <skill>/scripts/dive.py build docs/dives/<slug>`, and fix any errors. Return the list of cuts, one line each.

Open the page: `open docs/dives/<slug>/index.html` on macOS, `xdg-open` on Linux. Give the user the path, the level with its reason, and one sentence about the story. Leave all files uncommitted.
