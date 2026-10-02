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
  SKILL.md                    entry point: the four steps (prep, plan, write, build), for the orchestrator
  references/                 loaded on demand
    plan.md                   step 2, the orchestrator: read the scope, pick the flows, plan.md and dive.json formats
    briefs.md                 step 3, the writers: rules for every writer, then the flow, intro and map writer jobs
    story.md                  how the dive tells its story: chapters, flows, sequences, code steps (writers)
    writing.md                Simplified Technical English rules and the slot limits (writers)
    format.md                 part-file JSON and what the build rejects (writers)
  scripts/dive.py             prep (fetch PR, diff.json) + level (new or familiar) + build (validate, bake index.html, reading time)
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
npm test         # node --test: the *.test.ts files next to the logic they cover
```

Rebuild the template only at checkpoints and commit it. The template holds
`<script id="dive-data" type="application/json">__DIVE_DATA__</script>`; `dive.py build` swaps the whole tag's content for the dive data. When the content is not valid JSON (dev), the app fetches `dive.json`.

## Data contract

`app/src/types.ts` is the contract. Change its copies with it:

- `skills/dive/references/format.md`: the authored part, as TS, for writers.
- `## dive.json` in `skills/dive/references/plan.md`: `Dive` and `Source`, for the orchestrator.
- `CHAPTERS`, `REQUIRED` and `CHANGES` in `skills/dive/scripts/dive.py`, which the build checks.

The build's checks are listed for agents in format.md `## What the build rejects`. When a check in `dive.py` changes, change it there.

## Commits

Conventional commits: `feat(app): ...`, `feat(skill): ...`, `fix(...)`, `chore: ...`, `docs: ...`. No AI co-author trailers.
