#!/usr/bin/env python3
"""Prep and build a dive. Run from inside the repository. Python 3.9+, stdlib only.

  dive.py prep  <dir> --pr <number|url> [--base <branch>]   fetch the PR, write <dir>/diff.json
  dive.py build <dir>                                       merge parts, validate, embed code, write <dir>/index.html
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
CHAPTERS = ['why', 'glossary', 'big-picture', 'happy-path', 'edge-cases', 'review-focus', 'recap']
REQUIRED = {
    'card': ('title', 'body'),
    'terms': ('title', 'terms'),
    'code': ('title', 'say', 'notes'),
    'sequence': ('title', 'say', 'actors', 'messages'),
    'diagram': ('title', 'say', 'nodes', 'edges'),
    'quiz': ('title', 'question', 'options'),
}
LOCKFILES = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'poetry.lock', 'Pipfile.lock',
             'uv.lock', 'Cargo.lock', 'Gemfile.lock', 'composer.lock', 'go.sum'}
MAX_LINES = 3000  # unreferenced changed files longer than this are not embedded
LANGS = {'ts': 'ts', 'tsx': 'tsx', 'js': 'js', 'jsx': 'jsx', 'mjs': 'js', 'cjs': 'js', 'json': 'json',
         'py': 'python', 'go': 'go', 'java': 'java', 'kt': 'kotlin', 'kts': 'kotlin', 'rb': 'ruby', 'rs': 'rust',
         'php': 'php', 'cs': 'csharp', 'swift': 'swift', 'sql': 'sql', 'yml': 'yaml', 'yaml': 'yaml',
         'sh': 'bash', 'bash': 'bash', 'zsh': 'bash', 'css': 'css', 'scss': 'scss', 'html': 'html',
         'md': 'markdown', 'vue': 'vue', 'svelte': 'svelte', 'c': 'c', 'h': 'c', 'cpp': 'cpp', 'cc': 'cpp',
         'hpp': 'cpp', 'scala': 'scala', 'dart': 'dart', 'ex': 'elixir', 'exs': 'elixir', 'toml': 'toml',
         'xml': 'xml', 'graphql': 'graphql', 'proto': 'proto', 'tf': 'hcl'}
NAMES = {'Dockerfile': 'dockerfile', 'Makefile': 'make'}
HUNK = re.compile(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@')


def git(*args, check=True):
    r = subprocess.run(['git', *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode:
        if check:
            sys.exit(f"git {' '.join(args)} failed:\n{r.stderr.strip()}")
        return None
    return r.stdout


def repo_slug():
    url = (git('remote', 'get-url', 'origin', check=False) or '').strip()
    m = re.search(r'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?/?$', url)
    return m.group(1) if m else None


def default_branch():
    ref = git('symbolic-ref', '--short', 'refs/remotes/origin/HEAD', check=False)
    if ref:
        return ref.strip().split('/', 1)[1]
    m = re.search(r'ref: refs/heads/(\S+)\tHEAD', git('ls-remote', '--symref', 'origin', 'HEAD'))
    if not m:
        sys.exit('Cannot find the default branch. Pass --base <branch>.')
    return m.group(1)


def diff_files(base, head, context=3):
    """Changed files with hunks, in git's order."""
    names = git('diff', '-M', '--name-status', '-z', base, head).split('\0')
    files, i = [], 0
    while i < len(names) - 1:
        st = names[i]
        if st[0] == 'R':
            files.append({'path': names[i + 2], 'oldPath': names[i + 1], 'status': 'renamed'})
            i += 3
        else:
            files.append({'path': names[i + 1], 'status': {'A': 'added', 'D': 'deleted'}.get(st[0], 'modified')})
            i += 2
    chunks = re.split(r'^diff --git ', git('diff', '-M', f'-U{context}', base, head), flags=re.M)[1:]
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
    return files


def prep(d, pr, base_ref):
    m = re.search(r'pull/(\d+)', pr) or re.fullmatch(r'#?(\d+)', pr.strip())
    if not m:
        sys.exit(f'Not a PR number or URL: {pr}')
    n = int(m.group(1))
    base_ref = base_ref or default_branch()
    git('fetch', '-q', 'origin', f'+refs/pull/{n}/head:refs/dive/pr-{n}',
        f'+refs/heads/{base_ref}:refs/remotes/origin/{base_ref}')
    head = git('rev-parse', f'refs/dive/pr-{n}').strip()
    base = git('merge-base', f'refs/remotes/origin/{base_ref}', head).strip()
    repo = repo_slug()
    files = diff_files(base, head)
    diff = {'repo': repo, 'pr': n, 'url': f'https://github.com/{repo}/pull/{n}' if repo else None,
            'baseRef': base_ref, 'base': base, 'head': head, 'files': files}
    d.mkdir(parents=True, exist_ok=True)
    (d / 'diff.json').write_text(json.dumps(diff, indent=1, ensure_ascii=False))
    adds, dels = sum(f['additions'] for f in files), sum(f['deletions'] for f in files)
    print(f'PR #{n}: {len(files)} files, +{adds} -{dels}\nbase={base} ({base_ref})\nhead={head}\nAreas (files, changed lines):')
    areas = {}
    for f in files:
        key = '/'.join(f['path'].split('/')[:-1][:2]) or '.'
        a = areas.setdefault(key, [0, 0])
        a[0] += 1
        a[1] += f['additions'] + f['deletions']
    for key, (nf, nl) in sorted(areas.items(), key=lambda kv: -kv[1][1]):
        print(f'  {key:<40} {nf:>4} {nl:>6}')


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
    refs = {n['file'] for c in dive['chapters'] for s in c['steps'] if s.get('kind') == 'code'
            for n in s.get('notes') or [] if n.get('file')}
    files, skipped = {}, []
    if diff:
        full = diff_files(diff['base'], diff['head'], context=10 ** 7)
        for f in full:
            p = f['path']
            body = [l for h in f['hunks'] for l in h['lines']]
            if f.get('binary') or not f['hunks']:
                continue  # binary or rename-only: referenced ones fall through to plain text below
            if p not in refs and (p.rsplit('/', 1)[-1] in LOCKFILES or len(body) > MAX_LINES):
                skipped.append(p)
                continue
            files[p] = {'lang': lang(p), 'diff': True, 'text': '\n'.join(body), 'status': f['status']}
            if f.get('oldPath'):
                files[p]['oldPath'] = f['oldPath']
    for p in refs - files.keys():
        if diff:
            text = git('show', f"{diff['head']}:{p}", check=False)
        else:
            path = Path(git('rev-parse', '--show-toplevel').strip()) / p
            text = path.read_text(encoding='utf-8', errors='replace') if path.is_file() else None
        if text is not None:
            files[p] = {'lang': lang(p), 'diff': False, 'text': text}
    return files, skipped


def validate(dive, files):
    errs = []

    def need(obj, where, keys):
        errs.extend(f'{where}: missing "{k}"' for k in keys if not obj.get(k))

    need(dive, 'dive.json', ('title', 'summary', 'source'))
    if (dive.get('source') or {}).get('kind') not in ('pr', 'module', 'question', 'doc'):
        errs.append('dive.json: source.kind must be pr, module, question or doc')
    if not dive['chapters']:
        errs.append('dive.json: no chapter has steps')
    for c in dive['chapters']:
        for i, s in enumerate(c['steps'], 1):
            k = s.get('kind')
            w = f"{c['id']} step {i} ({k} '{s.get('title', '')}')"
            if k not in REQUIRED:
                errs.append(f'{w}: kind must be one of {", ".join(REQUIRED)}')
                continue
            need(s, w, REQUIRED[k])
            if k == 'terms':
                for t in s.get('terms') or []:
                    need(t, f'{w} term', ('term', 'meaning'))
            elif k == 'code':
                for j, n in enumerate(s.get('notes') or [], 1):
                    need(n, f'{w} note {j}', ('file', 'text'))
                    p, ln, side = n.get('file'), n.get('lines'), n.get('side', 'new')
                    f = files.get(p)
                    if p and not f:
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
            elif k == 'sequence':
                ids = {a.get('id') for a in s.get('actors') or []}
                for j, m in enumerate(s.get('messages') or [], 1):
                    need(m, f'{w} message {j}', ('from', 'to', 'label'))
                    if m.get('from') not in ids or m.get('to') not in ids:
                        errs.append(f'{w} message {j}: from/to must be actor ids ({", ".join(sorted(map(str, ids)))})')
                    if m.get('type', 'call') not in ('call', 'return', 'async', 'error'):
                        errs.append(f'{w} message {j}: type must be call, return, async or error')
            elif k == 'diagram':
                ids = {n.get('id') for n in s.get('nodes') or []}
                refs = [(e.get('from'), e.get('to')) for e in s.get('edges') or []]
                bad = {x for pair in refs for x in pair} | {x for n in s.get('notes') or [] for x in n.get('focus') or []}
                if bad - ids:
                    errs.append(f'{w}: unknown node ids {sorted(map(str, bad - ids))}')
            elif k == 'quiz':
                opts = s.get('options') or []
                if not 3 <= len(opts) <= 4:
                    errs.append(f'{w}: needs 3-4 options')
                if sum(bool(o.get('correct')) for o in opts) != 1:
                    errs.append(f'{w}: needs exactly one correct option')
                for o in opts:
                    need(o, f'{w} option', ('text', 'why'))
    return errs


def changed(h):
    o, n, old, new = h['oldStart'], h['newStart'], set(), set()
    for l in h['lines']:
        if l[0] == '+':
            new.add(n)
            n += 1
        elif l[0] == '-':
            old.add(o)
            o += 1
        else:
            o, n = o + 1, n + 1
    return old, new


def coverage(dive, diff):
    """Changed hunks that no code note touches, and files no step or card mentions."""
    notes, cards = {}, ''
    for c in dive['chapters']:
        for s in c['steps']:
            if s.get('kind') == 'code':
                for n in s['notes']:
                    notes.setdefault(n['file'], []).append((n.get('side', 'new'), *n['lines']))
            elif s.get('kind') == 'card':
                cards += s.get('body', '') + ' '.join(l.get('url', '') for l in s.get('links') or [])
    gaps = []
    for f in diff['files']:
        p = f['path']
        if p in cards:  # listed in a card: the card explains the hunks no note covers
            continue
        if p not in notes:
            gaps.append(f"{p} (+{f['additions']} -{f['deletions']}): in no step or card")
            continue
        for h in f['hunks']:
            old, new = changed(h)
            if not new:  # pure deletion: a new-side note around the spot counts too
                new = set(range(h['newStart'], h['newStart'] + h['newLines'] + 1))
            hit = any(any(a <= x <= b for x in (old if side == 'old' else new)) for side, a, b in notes[p])
            if not hit:
                gaps.append(f"{p}:{h['newStart']}-{h['newStart'] + max(h['newLines'], 1) - 1}: hunk in no note")
    return gaps


def load(path, errs):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as e:
        errs.append(f'{path.name}: {e}')
        return None


def build(d):
    errs = []
    dive = load(d / 'dive.json', errs)
    if dive is None:
        sys.exit(f'Cannot read {d}/dive.json: {errs[0]}')
    chapters = {c.get('id'): c for c in dive.get('chapters') or []}
    parts = sorted((d / 'parts').glob('*.json')) if (d / 'parts').is_dir() else []
    merged = {}
    for p in parts:  # parts/<id>.json, or <id>.1.json, <id>.2.json for a split chapter
        c = load(p, errs) or {}
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
    errs += validate(dive, files)
    if errs:
        print(f'{len(errs)} errors. Fix them in parts/ or dive.json, then build again:')
        print('\n'.join(f'  {e}' for e in errs))
        sys.exit(1)

    if not TEMPLATE.read_text().count(PLACEHOLDER):
        sys.exit(f'{TEMPLATE} has no data placeholder.')
    (d / 'dive.json').write_text(json.dumps(dive, indent=2, ensure_ascii=False))
    for p in parts:  # merged into dive.json; from now on edit dive.json
        p.unlink()
    if parts and not any((d / 'parts').iterdir()):
        (d / 'parts').rmdir()
    data = json.dumps({**dive, 'files': files}, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    out = d / 'index.html'
    out.write_text(TEMPLATE.read_text().replace(PLACEHOLDER, DATA_TAG + data + '</script>', 1))
    steps = sum(len(c['steps']) for c in dive['chapters'])
    print(f"Built {out} ({out.stat().st_size // 1024} KB): {len(dive['chapters'])} chapters, {steps} steps.")
    if skipped:
        print(f"Not embedded (lockfile or > {MAX_LINES} lines): {', '.join(skipped)}")
    gaps = coverage(dive, diff) if diff else []
    if gaps:
        print(f'Coverage: {len(gaps)} gaps. Explain each in a code note, or list the file in an "Also changed" card:')
        print('\n'.join(f'  {g}' for g in gaps))
    elif diff:
        print('Coverage: every changed hunk is in a note or card.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('prep')
    p.add_argument('dir', type=Path)
    p.add_argument('--pr', required=True)
    p.add_argument('--base')
    b = sub.add_parser('build')
    b.add_argument('dir', type=Path)
    a = ap.parse_args()
    prep(a.dir, a.pr, a.base) if a.cmd == 'prep' else build(a.dir)


if __name__ == '__main__':
    main()
