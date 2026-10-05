import { deepStrictEqual as eq, ok } from 'node:assert/strict'
import { askContext, askPrompt, askTargets, focusText } from './ask.ts'
import type { Dive } from './types.ts'

const msg = (step?: string) => ({ from: 'a', to: 'b', label: 'call', note: 'n', step })
const seq = (kind: string, step?: string) => ({
  kind,
  id: kind,
  title: kind,
  say: '',
  actors: [],
  messages: [msg(step)],
})
const new35 = { file: 'src/a.ts', lines: [3, 5], text: 'new' }
const notes = [new35, { file: 'src/a.ts', lines: [1, 2], side: 'old', text: 'gone' }, new35]
const dive = {
  title: 'T',
  summary: 's',
  source: { kind: 'pr', ref: '1', repo: 'o/r', base: 'b0', head: 'h1' },
  chapters: [
    { id: 'big-picture', title: 'Big picture', steps: [seq('sequence', 'flow')] },
    {
      id: 'walkthrough',
      title: 'W',
      steps: [seq('flow', 'c1'), { kind: 'code', id: 'c1', title: 'C', say: '', notes }],
    },
  ],
} as Dive

const url = 'file:///Users/me/my%20repo/docs/dives/pr-1-x/index.html'
const code = askContext(dive, { c: 1, s: 1, f: 0 }, url)
eq(
  [code.cwd, code.page, code.flow, code.refs],
  ['/Users/me/my repo', 'docs/dives/pr-1-x/index.html', 'flow', ['src/a.ts:3-5']],
)
eq(code.step, 'W › flow › C (note 1 of 3)')
const prompt = askPrompt(code, ' why? \n')
for (const s of ['(docs/dives/pr-1-x/index.html)', '## flow flow` in docs/dives/pr-1-x/plan.md', 'src/a.ts:3-5', 'h1'])
  ok(prompt.includes(s), s)
ok(prompt.endsWith(' why?'), 'ends with the trimmed question')
eq(focusText(dive.chapters[1].steps[1], 0, code), 'note 1 of 3, src/a.ts:3-5: new', 'live region, code note')
const hop = askContext(dive, { c: 1, s: 0, f: 0 }, url)
eq(focusText(dive.chapters[1].steps[0], 0, hop), 'a → b: call. n', 'one message: no counter, no refs')
eq(askContext(dive, { c: 1, s: 1, f: 1 }, url).refs, ['old src/a.ts:1-2'], 'old side')
const renamed = { ...dive, files: { 'src/a.ts': { lang: 'ts', diff: true, text: '', oldPath: 'src/z.ts' } } }
eq(askContext(renamed, { c: 1, s: 1, f: 1 }, url).refs, ['old src/z.ts:1-2'], 'old side of a renamed file')
eq(askContext(dive, { c: 1, s: 0, f: 0 }, url).refs, ['src/a.ts:3-5', 'old src/a.ts:1-2'], 'message refs its code step')

const over = askContext(dive, { c: 0, s: 0, f: 0 }, 'file:///C:/w/docs/dives/s/index.html')
eq([over.cwd, over.page, over.flow], ['C:/w', 'docs/dives/s/index.html', 'flow'], 'windows, overview links a flow')
eq(
  askContext(dive, { c: 0, s: 0, f: 0 }, 'file:///tmp/x/page.html').page,
  '/tmp/x/page.html',
  'elsewhere: the file itself',
)
const shared = askPrompt(askContext(dive, { c: 1, s: 1, f: 0 }, 'file:///Users/me/Downloads/index.html'), 'q')
ok(
  !shared.includes('Plan of this flow') && shared.includes('git show h1:') && shared.includes('git diff b0 h1'),
  shared,
)

const web = askContext(dive, { c: 1, s: 1, f: 0 }, 'http://localhost:5173/#/1/1/0')
eq([web.cwd, web.page], [undefined, undefined])
const [claude] = askTargets(web, askPrompt(web, 'q'))
ok(claude.href.includes('repo=o%2Fr') && !claude.href.includes('cwd='), claude.href)
ok(askTargets(code, prompt)[0].href.includes('cwd=%2FUsers%2Fme%2Fmy%20repo'))
for (const t of askTargets(code, prompt)) ok(t.href.includes('%0A') && !t.href.includes('\n'), t.label)
const codex = (c: typeof web) => askTargets(c, 'p').find((t) => t.label === 'Codex')!.href
ok(codex(code).includes('path=%2FUsers%2Fme') && codex(web).includes('originUrl=https%3A%2F%2Fgithub.com%2Fo%2Fr'))
