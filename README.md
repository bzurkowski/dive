# dive

`dive` is an Agent Skill that explains a pull request, a code module, a domain question, or a knowledge-base page as an interactive walkthrough.
It tells a story in small steps: the problem, the glossary, the big picture, then the happy path and the edge cases, with real code, animated diagrams, and short quizzes.
The result is one self-contained `docs/dives/<slug>/index.html` you can open, attach, or share.

Example: [`examples/pr-842-network-error-retry`](examples/pr-842-network-error-retry), a dive into [sindresorhus/ky#842](https://github.com/sindresorhus/ky/pull/842). Open its `index.html` in a browser.

## Install

**Claude Code**

```
/plugin marketplace add <owner>/dive
/plugin install dive@dive
```

**Codex and Cursor**: this repo is also a Codex plugin (`.codex-plugin/`, marketplace in `.agents/plugins/`) and a Cursor plugin (`.cursor-plugin/`). Add `<owner>/dive` as a plugin source in your agent.

**Any other agent** that reads Agent Skills:

```
npx skills add <owner>/dive
```

Or copy `skills/dive/` into your agent's skills directory.

Requirements: `git` and `python3`. `gh` is optional.

## Use

```
/dive 1234                                   # a pull request number
/dive https://github.com/acme/shop/pull/1234 # a pull request URL
/dive src/payments                           # a module
/dive how do refunds get retried?            # a domain question
/dive https://www.notion.so/acme/Refunds-123 # a knowledge page (needs its connector)
```

The dive opens in your browser when it is ready. Nothing is committed.

## Develop the walkthrough app

The app lives in `app/` (Vite, React, TypeScript, Tailwind) and is not shipped. The skill ships its build, `skills/dive/assets/template.html`.

```
cd app
npm install
npm run dev     # uses public/dive.json as data
npm run build   # rebuilds skills/dive/assets/template.html
```

Test the build script: `python3 -m unittest tests/test_dive.py`.
