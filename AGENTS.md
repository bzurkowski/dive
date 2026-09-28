# dive

`dive` is an Agent Skill. It turns a pull request, a code module, or a question about the codebase into an interactive walkthrough: one self-contained `index.html` in `docs/dives/<slug>/` of the user's repo.

## Mantra

Simple and fast. If the skill is slow or long, people do not use it.

- Short instructions. Concrete steps. No speculative features.
- Speed comes from parallel subagents, not from cutting content.
- One tiny stdlib script (`dive.py`). No lint or build pipelines at skill runtime.

## Layout

```
skills/dive/                  the skill (this is what ships)
  SKILL.md                    entry point: the workflow
  references/                 loaded on demand (scouts, story, format, writing)
  scripts/dive.py             prep (fetch PR, diff.json) + build (validate, bake index.html, reading time)
  assets/template.html        built walkthrough app, data placeholder inside
app/                          walkthrough app source (Vite + React + TS + Tailwind); never shipped
  src/types.ts                data contract: single source of truth for dive.json
  public/dive.json            dev fixture (baked format)
.claude-plugin/ .codex-plugin/ .cursor-plugin/ .agents/plugins/   plugin manifests (source = repo root)
```

## App dev loop

```
cd app
npm run dev      # serves public/dive.json as the data
npm run build    # writes ../skills/dive/assets/template.html
npm run format   # prettier; index.html is ignored (dive.py matches its data tag verbatim)
```

Rebuild the template only at checkpoints and commit it. The template holds
`<script id="dive-data" type="application/json">__DIVE_DATA__</script>`; `dive.py build` swaps the whole tag's content for the dive data. When the content is not valid JSON (dev), the app fetches `dive.json`.

## Data contract

`app/src/types.ts` is the contract. `skills/dive/references/format.md` mirrors the authored part for agents. Change both together.

## Commits

Conventional commits: `feat(app): ...`, `feat(skill): ...`, `fix(...)`, `chore: ...`, `docs: ...`. No AI co-author trailers.
