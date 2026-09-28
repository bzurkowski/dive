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
  references/                 loaded on demand
    briefs.md                 every subagent prompt: scouts, writers, the scout-note format
    outline.md                step 3, the architect: flows, outline format, dive.json frame, checklist
    story.md                  story rules: chapters, flows, sequences, code steps (architect and writers)
    format.md                 part-file JSON and the rules the build rejects (writers)
    writing.md                prose rules (writers)
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
- `## The dive.json frame` in `skills/dive/references/outline.md`: `Dive` and `Source`, for the architect.
- `CHAPTERS`, `REQUIRED` and `CHANGES` in `skills/dive/scripts/dive.py`, which the build checks.

The build's checks are listed for agents twice: format.md `## Structure` and the `(build)` lines of outline.md `## Checklist`. When a check in `dive.py` changes, change both.

`references/briefs.md` repeats three rules word for word, because a subagent sees only its prompt: the edge-case definition (outline.md `## From call chains to flows`), the actor definition (story.md `## Sequences`), and the hop rule (story.md Messages, with "hop" for "message"). Change them together.

## Commits

Conventional commits: `feat(app): ...`, `feat(skill): ...`, `fix(...)`, `chore: ...`, `docs: ...`. No AI co-author trailers.
