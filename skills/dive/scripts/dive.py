#!/usr/bin/env python3
"""Prep and build a dive. Run from inside the repository. Python 3.9+, stdlib only.

  dive.py prep  <dir> --pr <number|url> [--base <branch>]   fetch the PR, write <dir>/diff.json
  dive.py build <dir>                                       merge parts, validate, embed code, write <dir>/index.html
  dive.py check <dir>/parts/<part>.json                     validate one part alone, write nothing
  dive.py level <path>... [--rev <rev>]                     print new or familiar from your commits under <path>
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parent.parent / 'assets' / 'template.html'
DATA_TAG = '<script id="dive-data" type="application/json">'
PLACEHOLDER = DATA_TAG + '__DIVE_DATA__</script>'
CHAPTERS = ['intro', 'glossary', 'big-picture', 'walkthrough', 'review-focus']
REQUIRED = {
    'card': ('title', 'body'),
    'terms': ('title', 'terms'),
    'code': ('title', 'say', 'notes'),
    'sequence': ('title', 'say', 'actors', 'messages'),
    'flow': ('id', 'title', 'say', 'actors', 'messages'),
    'edge': ('title', 'say', 'actors', 'messages'),
    'diagram': ('title', 'say', 'nodes', 'edges'),
    'quiz': ('title', 'question', 'options'),
}
LOCKFILES = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'poetry.lock', 'Pipfile.lock',
             'uv.lock', 'Cargo.lock', 'Gemfile.lock', 'composer.lock', 'go.sum'}
TEST_FILE = re.compile(r'(^|/)([Tt]ests?|__tests__|__mocks__|mocks?|spec|e2e|integration-tests|fixtures|testdata)/'
                       r'|(^|/)test_[^/]*$|[._-](test|spec)s?\.[^/]*$|[a-z0-9](Tests?|Spec)\.[^/]*$')
MAX_LINES = 3000  # unreferenced changed files longer than this are not embedded
LANGS = {'ts': 'ts', 'tsx': 'tsx', 'js': 'js', 'jsx': 'jsx', 'mjs': 'js', 'cjs': 'js', 'json': 'json',
         'py': 'python', 'go': 'go', 'java': 'java', 'kt': 'kotlin', 'kts': 'kotlin', 'rb': 'ruby', 'rs': 'rust',
         'php': 'php', 'cs': 'csharp', 'swift': 'swift', 'sql': 'sql', 'yml': 'yaml', 'yaml': 'yaml',
         'sh': 'bash', 'bash': 'bash', 'zsh': 'bash', 'css': 'css', 'scss': 'scss', 'html': 'html',
         'md': 'markdown', 'vue': 'vue', 'svelte': 'svelte', 'c': 'c', 'h': 'c', 'cpp': 'cpp', 'cc': 'cpp',
         'hpp': 'cpp', 'scala': 'scala', 'dart': 'dart', 'ex': 'elixir', 'exs': 'elixir', 'toml': 'toml',
         'xml': 'xml', 'graphql': 'graphql', 'proto': 'proto', 'tf': 'hcl'}
NAMES = {'Dockerfile': 'dockerfile', 'Makefile': 'make'}
PROSE = {'title', 'summary', 'say', 'text', 'body', 'term', 'meaning', 'question', 'why', 'label', 'note'}
DIFF = ('-M', '--no-color', '--no-ext-diff')  # user git settings must not change the output
HUNK = re.compile(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@')
NEW_BELOW = 10  # ponytail: first guess, tune after real dives
SEQUENCES = ('sequence', 'flow', 'edge')
STEP_ID = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*$')
CHANGES = ('added', 'changed', 'removed')


def git(*args, check=True):
    r = subprocess.run(['git', *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        if check:
            sys.exit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
        return None
    return r.stdout


def repo_slug(remote='origin'):
    url = (git('remote', 'get-url', remote, check=False) or '').strip()
    m = re.search(r'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?/?$', url)
    return m.group(1) if m else None


def pr_remote(pr):
    """The remote that holds the PR: the one whose repo the PR URL names, else origin."""
    m = re.search(r'github\.com/([^/]+/[^/]+)/pull/', pr)
    if not m:
        return 'origin'
    for r in git('remote').split():
        if (repo_slug(r) or '').lower() == m.group(1).lower():
            return r
    sys.exit(f'The PR is in {m.group(1)}, and no remote of this repo points there. '
             f'Run the dive in a clone of {m.group(1)}, or add it as a remote.')


def default_branch(remote):
    ref = git('symbolic-ref', '--short', f'refs/remotes/{remote}/HEAD', check=False)
    if ref:
        return ref.strip().split('/', 1)[1]
    m = re.search(r'ref: refs/heads/(\S+)\tHEAD', git('ls-remote', '--symref', remote, 'HEAD'))
    if not m:
        sys.exit('Cannot find the default branch. Pass --base <branch>.')
    return m.group(1)


def diff_files(base, head, context=3):
    """Changed files with hunks, in the order of git, without test files."""
    names = git('diff', *DIFF, '--name-status', '-z', base, head).split('\0')
    files, i = [], 0
    while i < len(names) - 1:
        st = names[i]
        if st[0] == 'R':
            files.append({'path': names[i + 2], 'oldPath': names[i + 1], 'status': 'renamed'})
            i += 3
        else:
            files.append({'path': names[i + 1], 'status': {'A': 'added', 'D': 'deleted'}.get(st[0], 'modified')})
            i += 2
    chunks = re.split(r'^diff --git ', git('diff', *DIFF, f'-U{context}', base, head), flags=re.M)[1:]
    if len(chunks) != len(files):
        sys.exit(f'Diff parse error: {len(chunks)} diffs for {len(files)} files.')
    for f, chunk in zip(files, chunks):
        hunks = []
        for line in chunk.split('\n'):
            m = HUNK.match(line)
            if m:
                a, b, c, d = m.groups()
                hunks.append({'oldStart': int(a), 'oldLines': 1 if b is None else int(b),
                              'newStart': int(c), 'newLines': 1 if d is None else int(d), 'lines': []})
            elif hunks and line[:1] in (' ', '+', '-'):
                hunks[-1]['lines'].append(line)
        f['hunks'] = hunks
        f['additions'] = sum(l[0] == '+' for h in hunks for l in h['lines'])
        f['deletions'] = sum(l[0] == '-' for h in hunks for l in h['lines'])
        if not hunks and '\nBinary files ' in '\n' + chunk:
            f['binary'] = True
    return [f for f in files if not TEST_FILE.search(f['path'])]


def prep(d, pr, base_ref):
    m = re.search(r'pull/(\d+)', pr) or re.fullmatch(r'#?(\d+)', pr.strip())
    if not m:
        sys.exit(f'Not a PR number or URL: {pr}')
    n = int(m.group(1))
    remote = pr_remote(pr)
    base_ref = base_ref or default_branch(remote)
    tip = f'refs/remotes/{remote}/{base_ref}'
    git('fetch', '-q', remote, f'+refs/pull/{n}/head:refs/dive/pr-{n}', f'+refs/heads/{base_ref}:{tip}')
    head = git('rev-parse', f'refs/dive/pr-{n}').strip()
    base = git('merge-base', tip, head).strip()
    if base == head:  # merged with a merge commit: diff against the base branch as it was at the merge
        merges = git('rev-list', '--ancestry-path', '--merges', '--reverse', f'{head}..{tip}').split()
        if not merges:
            sys.exit(f'PR #{n} is already in {base_ref} without a merge commit. Cannot find its changes.')
        base = git('merge-base', f'{merges[0]}^1', head).strip()
    repo = repo_slug(remote)
    files = diff_files(base, head)
    diff = {'repo': repo, 'pr': n, 'url': f'https://github.com/{repo}/pull/{n}' if repo else None,
            'baseRef': base_ref, 'base': base, 'head': head, 'files': files}
    d.mkdir(parents=True, exist_ok=True)
    (d / 'diff.json').write_text(json.dumps(diff, indent=1, ensure_ascii=False), encoding='utf-8')
    adds, dels = sum(f['additions'] for f in files), sum(f['deletions'] for f in files)
    print(f'PR #{n} into {base_ref}: {len(files)} files, +{adds} -{dels}\nbase={base}\nhead={head}')


def is_lockfile(path):
    return path.rsplit('/', 1)[-1] in LOCKFILES


def lang(path):
    name = path.rsplit('/', 1)[-1]
    return NAMES.get(name) or LANGS.get(name.rsplit('.', 1)[-1] if '.' in name else '', 'text')


def side_len(f, side):
    if not f['diff']:
        return len(f['text'].splitlines())
    skip = '-' if side == 'new' else '+'
    return sum(1 for l in f['text'].split('\n') if l[:1] in (' ', '+', '-') and l[0] != skip)


def embed_files(dive, diff):
    """Build the `files` map: changed files as full-context diffs, referenced files as text."""
    refs = {n['file'] for c in dive['chapters'] for s in c['steps'] if isinstance(s, dict) and s.get('kind') == 'code'
            for n in s.get('notes') or [] if isinstance(n, dict) and n.get('file')}
    files, skipped = {}, []
    if diff:
        full = diff_files(diff['base'], diff['head'], context=10 ** 7)
        for f in full:
            p = f['path']
            body = [l for h in f['hunks'] for l in h['lines']]
            if f.get('binary') or not f['hunks']:
                continue  # binary or rename-only: referenced ones fall through to plain text below
            if p not in refs and (is_lockfile(p) or len(body) > MAX_LINES):
                skipped.append(p)
                continue
            files[p] = {'lang': lang(p), 'diff': True, 'text': '\n'.join(body), 'status': f['status']}
            if f.get('oldPath'):
                files[p]['oldPath'] = f['oldPath']
    for p in refs - files.keys():
        if diff:
            text = git('show', f"{diff['head']}:{p}", check=False)
        else:
            root = Path(git('rev-parse', '--show-toplevel').strip()).resolve()
            path = (root / p).resolve()  # a note must not embed files outside the repo
            text = path.read_text(encoding='utf-8', errors='replace') if path.is_file() and path.is_relative_to(root) else None
        if text is not None:
            files[p] = {'lang': lang(p), 'diff': False, 'text': text}
    return files, skipped


def validate(dive, files, partial=False):
    errs = []

    def need(obj, where, keys=()):
        """Report missing keys. False when obj is not a JSON object."""
        if not isinstance(obj, dict):
            errs.append(f'{where}: must be an object, not {json.dumps(obj)[:40]}')
            return False
        errs.extend(f'{where}: missing "{k}"' for k in keys if not obj.get(k))
        return True

    need(dive, 'dive.json', ('title', 'summary', 'source'))
    src = dive.get('source') or {}
    need(src, 'dive.json source', ('ref',))
    if src.get('kind') not in ('pr', 'module', 'question'):
        errs.append('dive.json: source.kind must be pr, module or question')
    for j, l in enumerate(src.get('links') or [], 1):
        need(l, f'dive.json source link {j}', ('title', 'url'))
    if not dive['chapters']:
        errs.append('dive.json: no chapter has steps')
    pr = src.get('kind') == 'pr'
    for c in dive['chapters']:
        need(c, f"chapter {c['id']}", ('title',))
        for i, s in enumerate(c['steps'], 1):
            if not need(s, f"{c['id']} step {i}"):
                continue
            k = s.get('kind')
            w = f"{c['id']} step {i} ({k} '{s.get('title', '')}')"
            if k not in REQUIRED:
                errs.append(f'{w}: kind must be one of {", ".join(REQUIRED)}')
                continue
            need(s, w, REQUIRED[k])
            for j, l in enumerate(s.get('links') or [], 1):
                need(l, f'{w} link {j}', ('title', 'url'))
            if k == 'terms':
                for j, t in enumerate(s.get('terms') or [], 1):
                    need(t, f'{w} term {j}', ('term', 'meaning'))
            elif k == 'code':
                for j, n in enumerate(s.get('notes') or [], 1):
                    if not need(n, f'{w} note {j}', ('file', 'text')):
                        continue
                    p, ln, side = n.get('file'), n.get('lines'), n.get('side', 'new')
                    f = files.get(p)
                    if p and TEST_FILE.search(p):
                        errs.append(f'{w} note {j}: {p} is a test file. Show production code only')
                    elif p and not f:
                        errs.append(f'{w} note {j}: file not found: {p}')
                    if side not in ('new', 'old'):
                        errs.append(f'{w} note {j}: side must be "new" or "old"')
                    elif not (isinstance(ln, list) and len(ln) == 2 and all(isinstance(x, int) for x in ln)
                              and 1 <= ln[0] <= ln[1]):
                        errs.append(f'{w} note {j}: lines must be [start, end] with 1 <= start <= end')
                    elif f and side == 'old' and not f['diff']:
                        errs.append(f'{w} note {j}: side "old" needs a changed file, {p} is unchanged')
                    elif f and ln[1] > side_len(f, side):
                        errs.append(f'{w} note {j}: lines {ln} outside {p} ({side} side has {side_len(f, side)} lines)')
            elif k in SEQUENCES:
                actors = s.get('actors') or []
                ids = {a.get('id') for j, a in enumerate(actors, 1) if need(a, f'{w} actor {j}', ('id', 'label'))}
                for j, a in enumerate(actors, 1):
                    if isinstance(a, dict) and 'group' in a and not isinstance(a['group'], str):
                        errs.append(f'{w} actor {j}: group must be a string')
                    errs.extend(f'{w} actor {j}: {e}' for e in change_errs(a, pr))
                reached = set()  # the first sender and every receiver so far
                for j, m in enumerate(s.get('messages') or [], 1):
                    if not need(m, f'{w} message {j}', ('from', 'to', 'label', 'note')):
                        continue
                    if reached and m.get('from') not in reached:
                        errs.append(f'{w} message {j}: no earlier message reaches "{m.get("from")}". '
                                    'Restore the skipped message or merge actors')
                    reached |= {m.get('from'), m.get('to')}
                    if m.get('from') not in ids or m.get('to') not in ids:
                        errs.append(f'{w} message {j}: from/to must be actor ids ({", ".join(sorted(map(str, ids)))})')
                    if m.get('type', 'call') not in ('call', 'return', 'async', 'error'):
                        errs.append(f'{w} message {j}: type must be call, return, async or error')
                    errs.extend(f'{w} message {j}: {e}' for e in change_errs(m, pr))
                    if 'step' in m and not isinstance(m['step'], str):
                        errs.append(f'{w} message {j}: step must be a step id')
            elif k == 'diagram':
                ids = {n.get('id') for j, n in enumerate(s.get('nodes') or [], 1) if need(n, f'{w} node {j}', ('id', 'label'))}
                refs = [(e.get('from'), e.get('to')) for j, e in enumerate(s.get('edges') or [], 1)
                        if need(e, f'{w} edge {j}', ('from', 'to'))]
                focus = {x for j, n in enumerate(s.get('notes') or [], 1) if need(n, f'{w} note {j}', ('focus', 'text'))
                         for x in n.get('focus') or []}
                bad = {x for pair in refs for x in pair} | focus
                if bad - ids:
                    errs.append(f'{w}: unknown node ids {sorted(map(str, bad - ids))}')
                if s.get('notes') and ids - focus:  # the view reveals nodes note by note
                    errs.append(f'{w}: nodes {sorted(map(str, ids - focus))} are in no note\'s focus, so they never show')
            elif k == 'quiz':
                opts = s.get('options') or []
                if not 3 <= len(opts) <= 4:
                    errs.append(f'{w}: needs 3-4 options')
                opts = [o for j, o in enumerate(opts, 1) if need(o, f'{w} option {j}', ('text', 'why'))]
                if sum(o.get('correct') is True for o in opts) != 1:
                    errs.append(f'{w}: needs exactly one correct option (correct: true)')
    return errs + links(dive, partial)


def change_errs(x, pr):
    if not isinstance(x, dict) or 'change' not in x:
        return []
    if not pr:
        return ['"change" marks only belong in a PR dive']
    return [] if x['change'] in CHANGES else [f'change must be one of {", ".join(CHANGES)}']


def split_flows(steps):
    """Walkthrough steps as [(flow step number, flow step, [(number, step) after it])]. Steps before the first flow are lost."""
    flows = []
    for i, s in enumerate(steps, 1):
        if isinstance(s, dict) and s.get('kind') == 'flow':
            flows.append((i, s, []))
        elif flows and isinstance(s, dict):
            flows[-1][2].append((i, s))
    return flows


def links(dive, partial=False):
    """Where each kind may go, step ids, and message links between steps."""
    errs, ids, overview = [], set(), []
    for c in dive['chapters']:
        for i, s in enumerate(c['steps'], 1):
            if not isinstance(s, dict):
                continue
            k, w = s.get('kind'), f"{c['id']} step {i} ({s.get('kind')} '{s.get('title', '')}')"
            if k in ('flow', 'edge') and c['id'] != 'walkthrough':
                errs.append(f'{w}: {k} steps belong in walkthrough')
            if k == 'sequence':
                if c['id'] == 'walkthrough':
                    errs.append(f'{w}: in walkthrough, open a flow with "flow" and draw an edge case with "edge"')
                overview.append((w, s))
            if 'id' in s or k == 'flow' or (k == 'code' and c['id'] == 'walkthrough'):
                sid = s.get('id')
                if not isinstance(sid, str) or not STEP_ID.match(sid):
                    errs.append(f'{w}: needs an "id" of lowercase letters, digits and dashes')
                elif sid in ids:
                    errs.append(f'{w}: id "{sid}" is used twice')
                ids.add(sid)
    # a link must be a string: a list or object would break the lookups below
    msgs = lambda s: [m for m in s.get('messages') or [] if isinstance(m, dict) and isinstance(m.get('step', ''), str)]
    wt = next((c for c in dive['chapters'] if c['id'] == 'walkthrough'), None)
    flows = split_flows(wt['steps']) if wt else []
    if wt and not (isinstance(wt['steps'][0], dict) and wt['steps'][0].get('kind') == 'flow'):
        errs.append('walkthrough step 1: the walkthrough starts with a flow step')
    for n, f, rest in flows:
        fw = f"walkthrough flow '{f.get('title', '')}'"
        code = {s.get('id'): i for i, s in rest if s.get('kind') == 'code' and isinstance(s.get('id'), str)}
        edges = [s for _, s in rest if s.get('kind') == 'edge']
        seen_edge = False
        for i, s in rest:
            if seen_edge and s.get('kind') != 'edge':
                errs.append(f"walkthrough step {i} ({s.get('kind')} '{s.get('title', '')}'): only edge steps may follow an edge step in a flow")
            seen_edge = seen_edge or s.get('kind') == 'edge'
        for s in [f, *edges]:
            for j, m in enumerate(msgs(s), 1):
                if 'step' in m and m['step'] not in code:
                    errs.append(f"walkthrough {s.get('kind')} '{s.get('title', '')}' message {j}: step \"{m['step']}\" "
                                f"is not a code step of this flow ({', '.join(code) or 'it has none'})")
        first = {}
        for j, m in enumerate(msgs(f), 1):
            first.setdefault(m.get('step'), j)
        for sid, i in code.items():
            if sid not in first:
                errs.append(f'walkthrough step {i} (code "{sid}"): no message of the flow links to it. '
                            f'Add "step": "{sid}" to the message it implements')
        order = [first[sid] for sid in code if sid in first]
        if order != sorted(order):
            errs.append(f'{fw}: code steps must follow the order of their first linking message')
    flow_ids = {f.get('id') for _, f, _ in flows}
    for w, s in [] if partial else overview:  # partial: the flows are in other parts
        for j, m in enumerate(msgs(s), 1):
            if 'step' in m and m['step'] not in flow_ids:
                errs.append(f"{w} message {j}: step \"{m['step']}\" is not a flow id ({', '.join(map(str, flow_ids)) or 'no flows'})")
    return errs


def card_links(dive):
    """The links of every card, without repeats or the PR itself: the sources the cover lists."""
    src = dive['source']
    seen = {src.get('url')} | {l.get('url') for l in src.get('links') or [] if isinstance(l, dict)}
    out = []
    for c in dive['chapters']:
        for s in c['steps']:
            for l in s.get('links') or []:
                if l['url'] not in seen:
                    seen.add(l['url'])
                    out.append(l)
    return out


def words(x):
    """Words the reader reads: strings under PROSE keys, anywhere in the dive."""
    if isinstance(x, dict):
        return sum(len(v.split()) if k in PROSE and isinstance(v, str) else words(v) for k, v in x.items())
    return sum(map(words, x)) if isinstance(x, list) else 0


def load(path, errs):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        errs.append(f'{path.name}: {e}')
        return None


def assemble(d, parts, partial=False):
    """dive.json with the parts merged in, validated: (dive, files, skipped, errors). Writes nothing."""
    errs = []
    dive = load(d / 'dive.json', errs)
    if not isinstance(dive, dict):
        sys.exit(f'Cannot read {d}/dive.json: {errs[0] if errs else "it must be a JSON object"}')
    chapters = {c.get('id'): c for c in dive.get('chapters') or [] if isinstance(c, dict)}
    merged = {}
    for p in parts:  # parts/<id>.json, or <id>.1.json, <id>.2.json: one per flow of the walkthrough
        c = load(p, errs)
        if not isinstance(c, dict):
            if c is not None:
                errs.append(f'{p.name}: must be an object with "id", "title" and "steps"')
            continue
        cid = p.name.split('.')[0]
        m = merged.setdefault(cid, {'id': cid, 'title': c.get('title', ''), 'steps': []})
        m['title'] = m['title'] or c.get('title', '')
        m['steps'] += c.get('steps') or []
    chapters.update(merged)
    errs += [f'chapter id "{c}" must be one of {", ".join(CHAPTERS)}' for c in chapters if c not in CHAPTERS]
    dive['chapters'] = [chapters[c] for c in CHAPTERS if chapters.get(c, {}).get('steps')]

    diff = load(d / 'diff.json', []) if (d / 'diff.json').exists() else None
    src = dive.setdefault('source', {})
    if diff:
        for k in ('repo', 'url', 'base', 'head'):
            if diff.get(k):
                src[k] = diff[k]
    else:
        for k, v in (('repo', repo_slug()), ('head', (git('rev-parse', 'HEAD', check=False) or '').strip())):
            if v and not src.get(k):
                src[k] = v
    files, skipped = embed_files(dive, diff)
    return dive, files, skipped, errs + validate(dive, files, partial)


def build(d):
    order = lambda p: (p.name.split('.')[0], int(p.name.split('.')[1]) if p.name.count('.') == 2 and p.name.split('.')[1].isdigit() else 0)
    parts = sorted((d / 'parts').glob('*.json'), key=order) if (d / 'parts').is_dir() else []
    dive, files, skipped, errs = assemble(d, parts)
    if errs:
        print(f'{len(errs)} errors. Fix them in parts/ or dive.json, then build again:')
        print('\n'.join(f'  {e}' for e in errs))
        sys.exit(1)

    template = TEMPLATE.read_text(encoding='utf-8')
    if PLACEHOLDER not in template:
        sys.exit(f'{TEMPLATE} has no data placeholder.')
    src = dive['source']
    src['links'] = (src.get('links') or []) + card_links(dive)
    if not src['links']:
        del src['links']
    (d / 'dive.json').write_text(json.dumps(dive, indent=2, ensure_ascii=False), encoding='utf-8')
    for p in parts:  # merged into dive.json. From now on, edit dive.json
        p.unlink()
    if parts and not any((d / 'parts').iterdir()):
        (d / 'parts').rmdir()
    data = json.dumps({**dive, 'files': files}, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    out = d / 'index.html'
    out.write_text(template.replace(PLACEHOLDER, DATA_TAG + data + '</script>', 1), encoding='utf-8')
    steps = sum(len(c['steps']) for c in dive['chapters'])
    print(f"Built {out} ({out.stat().st_size // 1024} KB): {len(dive['chapters'])} chapters, {steps} steps.")
    if skipped:
        print(f"Not embedded (lockfile or > {MAX_LINES} lines): {', '.join(skipped)}")
    w = words(dive)
    count = lambda steps: sum(len(s['notes']) for s in steps if s['kind'] == 'code')
    print(f"Reading: {w} words, {count(s for c in dive['chapters'] for s in c['steps'])} code notes, about {max(1, round(w / 200))} min.")
    wt = next((c for c in dive['chapters'] if c['id'] == 'walkthrough'), None)
    for _, f, rest in split_flows(wt['steps']) if wt else []:
        steps = [f, *(s for _, s in rest)]
        edges = sum(s['kind'] == 'edge' for s in steps)
        print(f"  flow '{f['title']}': {words(steps)} words, {count(steps)} code notes, "
              f"{len(f['messages'])} messages, {edges} edge cases")


def check(part):
    """Validate one part file before the other writers finish. Links from the overview to flows are not checked."""
    errs = assemble(part.resolve().parent.parent, [part], partial=True)[-1]
    print('\n'.join(errs) if errs else f'{part.name}: no errors')
    sys.exit(1 if errs else 0)


def level(paths, rev):
    """(level, reason): new if the user has few recent commits under paths, else familiar."""
    if (git('rev-parse', '--is-shallow-repository', check=False) or '').strip() == 'true':
        return 'familiar', 'shallow clone, cannot count your commits'
    who = [w for w in ((git('config', k, check=False) or '').strip() for k in ('user.email', 'user.name')) if w]
    if not who:
        return 'familiar', 'no git user.name or user.email'
    log = git('log', rev, '--no-merges', '--use-mailmap', '--since=1 year ago', '-F',
              *[f'--author={w}' for w in who], '--format=%H', '--', *paths, check=False)
    if log is None:
        return 'familiar', 'git log failed'
    n = len(log.split())
    return ('new' if n < NEW_BELOW else 'familiar',
            f'{n} of your commits touch {", ".join(paths)} in the last year (new below {NEW_BELOW})')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('prep')
    p.add_argument('dir', type=Path)
    p.add_argument('--pr', required=True)
    p.add_argument('--base')
    b = sub.add_parser('build')
    b.add_argument('dir', type=Path)
    c = sub.add_parser('check')
    c.add_argument('part', type=Path)
    lv = sub.add_parser('level')
    lv.add_argument('paths', nargs='+')
    lv.add_argument('--rev', default='HEAD')
    a = ap.parse_args()
    if a.cmd == 'prep':
        prep(a.dir, a.pr, a.base)
    elif a.cmd == 'build':
        build(a.dir)
    elif a.cmd == 'check':
        check(a.part)
    else:
        print('level=%s\nreason=%s' % level(a.paths, a.rev))


if __name__ == '__main__':
    main()
