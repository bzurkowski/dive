"""End-to-end check for skills/dive/scripts/dive.py: prep a fake PR, build, check output.

Run: python3 -m unittest tests/test_dive.py
"""
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

DIVE = Path(__file__).resolve().parent.parent / 'skills' / 'dive' / 'scripts' / 'dive.py'


def sh(cwd, *cmd):
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True).stdout


def pr_repo():
    """A clone of github.com/o/r (a bare repo on disk) with PR #1 on refs/pull/1/head. The clone stays on main."""
    tmp = Path(tempfile.mkdtemp())
    origin, work = tmp / 'github.com' / 'o' / 'r.git', tmp / 'work'
    sh(tmp, 'git', 'init', '-q', '--bare', '-b', 'main', str(origin))
    sh(tmp, 'git', 'clone', '-q', str(origin), str(work))
    git = lambda *a: sh(work, 'git', '-c', 'user.name=t', '-c', 'user.email=t@t', *a)
    (work / 'app.py').write_text('def pay(x):\n    return x\n')
    git('add', '.'); git('commit', '-qm', 'base'); git('push', '-q', 'origin', 'HEAD:main')
    sh(work, 'git', 'remote', 'set-head', 'origin', 'main')
    (work / 'app.py').write_text('def pay(x):\n    if x < 0:\n        raise ValueError(x)\n    return x\n')
    (work / 'util.py').write_text('X = 1\n')
    (work / 'app_test.py').write_text('assert True\n')
    git('add', '.'); git('commit', '-qm', 'pr'); git('push', '-q', 'origin', 'HEAD:refs/pull/1/head')
    git('reset', '-q', '--hard', 'HEAD~1')  # user's tree stays on base
    git('config', 'color.ui', 'always'); git('config', 'diff.external', 'echo')  # user settings prep must survive
    return work, git


def run(work, *a):
    # a read or write without encoding= breaks on Windows (cp1252 default): make it an error everywhere
    strict = ['-X', 'warn_default_encoding', '-W', 'error::EncodingWarning']
    return subprocess.run([sys.executable, *strict, str(DIVE), *a], cwd=work, capture_output=True, text=True)


def flow(*links, fid='f'):
    """A flow step whose messages link to the given code step ids, in order."""
    return {'kind': 'flow', 'id': fid, 'title': 'Pay', 'say': 'S', 'actors': [{'id': 'a', 'label': 'A', 'category': 'service'}],
            'messages': [{'from': 'a', 'to': 'a', 'label': 'l', 'note': 'n', 'step': x} for x in links]}


def changed(d):
    return [f['path'] for f in json.loads((d / 'diff.json').read_text())['files']]


class DiveTest(unittest.TestCase):
    def test_prep_and_build(self):
        work, git = pr_repo()
        d = work / 'docs' / 'dives' / 'pr-1'
        r = run(work, 'prep', str(d), '--pr', 'https://github.com/o/r/pull/1')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(changed(d), ['app.py', 'util.py'])

        (d / 'dive.json').write_text(json.dumps({'title': 'T', 'summary': 'S', 'source': {'kind': 'pr', 'ref': '1'}, 'chapters': []}))
        (d / 'parts').mkdir()
        step = {'kind': 'code', 'id': 'guard', 'title': 'Guard', 'say': 'A guard.', 'notes': [{'file': 'app.py', 'lines': [2, 9], 'text': 'x'}]}
        part = lambda: json.dumps({'id': 'walkthrough', 'title': 'Walkthrough', 'steps': [flow('guard'), step]})
        (d / 'parts' / 'walkthrough.1.json').write_text(part())
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 1)
        self.assertIn('outside app.py', r.stdout)

        step['notes'][0]['lines'] = [2, 3]
        (d / 'parts' / 'walkthrough.1.json').write_text(part())
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("Reading: 12 words, 1 code notes, about 1 min.\n  flow 'Pay': 9 words, 1 code notes, 1 messages, 0 edge cases", r.stdout)
        self.assertFalse((d / 'parts' / 'walkthrough.1.json').exists())

        html = (d / 'index.html').read_text()
        data = json.loads(re.search(r'<script id="dive-data" type="application/json">(.*?)</script>', html, re.S).group(1))
        self.assertEqual(data['chapters'][0]['id'], 'walkthrough')
        self.assertIn('+    if x < 0:', data['files']['app.py']['text'])
        self.assertEqual(len(data['source']['head']), 40)
        self.assertNotIn('links', data['source'])

        dive = json.loads((d / 'dive.json').read_text())
        link = {'title': 'Issue 7', 'url': 'https://github.com/o/r/issues/7'}
        card = lambda: {'kind': 'card', 'title': 'Why', 'body': 'Issue 7 asked for it.', 'links': [link]}
        dive['chapters'] += [{'id': 'intro', 'title': 'Intro', 'steps': [card()]}, {'id': 'review-focus', 'title': 'Review focus', 'steps': [card()]}]
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(json.loads((d / 'dive.json').read_text())['source']['links'], [link])

    def test_prep_merged_pr(self):
        work, git = pr_repo()
        (work / 'other.py').write_text('Y = 2\n')
        git('add', '.'); git('commit', '-qm', 'other PR')
        git('fetch', '-q', 'origin', 'refs/pull/1/head')
        git('merge', '-q', '--no-ff', '-m', 'Merge PR 1', 'FETCH_HEAD'); git('push', '-q', 'origin', 'HEAD:main')
        r = run(work, 'prep', str(work / 'd'), '--pr', '1')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(changed(work / 'd'), ['app.py', 'util.py'])

    def test_prep_stacked_pr(self):
        work, git = pr_repo()
        git('fetch', '-q', 'origin', 'refs/pull/1/head'); git('checkout', '-q', 'FETCH_HEAD')
        git('push', '-q', 'origin', 'HEAD:refs/heads/pr-1')
        (work / 'c.py').write_text('Z = 3\n')
        git('add', '.'); git('commit', '-qm', 'stacked'); git('push', '-q', 'origin', 'HEAD:refs/pull/2/head')
        r = run(work, 'prep', str(work / 'd'), '--pr', '2', '--base', 'pr-1')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(changed(work / 'd'), ['c.py'])

    def test_prep_pr_url_picks_remote(self):
        work, git = pr_repo()
        up, fork = work.parent / 'github.com' / 'o' / 'r.git', work.parent / 'github.com' / 'me' / 'r.git'
        sh(work, 'git', 'clone', '-q', '--bare', str(up), str(fork))  # a fork has no refs/pull
        git('remote', 'rename', 'origin', 'upstream'); git('remote', 'add', 'origin', str(fork))
        r = run(work, 'prep', str(work / 'd'), '--pr', 'https://github.com/o/r/pull/1', '--base', 'main')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(changed(work / 'd'), ['app.py', 'util.py'])
        r = run(work, 'prep', str(work / 'd'), '--pr', 'https://github.com/x/y/pull/1')
        self.assertEqual(r.returncode, 1)
        self.assertIn('no remote', r.stderr)

    def test_build_embeds_only_repo_files(self):
        work, git = pr_repo()
        (work.parent / 'secret.txt').write_text('token\n')
        d = work / 'd'
        d.mkdir()
        note = {'file': '../secret.txt', 'lines': [1, 1], 'text': 'x'}
        step = {'kind': 'code', 'id': 'c', 'title': 'T', 'say': 'S', 'notes': [note]}
        dive = {'title': 'T', 'summary': 'S', 'source': {'kind': 'module', 'ref': '.'},
                'chapters': [{'id': 'walkthrough', 'title': 'W', 'steps': [flow('c'), step]}]}
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run(work, 'build', str(d))
        self.assertIn('file not found: ../secret.txt', r.stdout)
        note['file'] = 'src/__tests__/app.spec.ts'
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run(work, 'build', str(d))
        self.assertIn('src/__tests__/app.spec.ts is a test file', r.stdout)
        note['file'] = 'app.py'
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout)

    def test_build_reports_shape_mistakes(self):
        work, git = pr_repo()
        d = work / 'd'
        (d / 'parts').mkdir(parents=True)
        (d / 'dive.json').write_text(json.dumps({'title': 'T', 'summary': 'S', 'source': {'kind': 'module'}, 'chapters': []}))
        quiz = {'kind': 'quiz', 'title': 'Q', 'question': 'Q?', 'options': [
            {'text': 'a', 'why': 'w', 'correct': True}, {'text': 'b', 'why': 'w', 'correct': 'false'}, 'c']}
        card = {'kind': 'card', 'title': 'C', 'body': 'B', 'links': [{'title': 'PR'}]}
        terms = {'kind': 'terms', 'title': 'T', 'terms': ['Refund']}
        (d / 'parts' / 'walkthrough.json').write_text(json.dumps([quiz]))
        (d / 'parts' / 'glossary.json').write_text(json.dumps({'id': 'glossary', 'steps': [terms, 'a step']}))
        (d / 'parts' / 'review-focus.json').write_text(json.dumps({'id': 'review-focus', 'title': 'R', 'steps': [quiz, card]}))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 1)
        self.assertNotIn('Traceback', r.stderr)
        for e in ['dive.json source: missing "ref"', 'walkthrough.json: must be an object',
                  'chapter glossary: missing "title"', "glossary step 1 (terms 'T') term 1: must be an object",
                  'glossary step 2: must be an object', "review-focus step 1 (quiz 'Q') option 3: must be an object",
                  "review-focus step 2 (card 'C') link 1: missing \"url\""]:
            self.assertIn(e, r.stdout)
        self.assertNotIn('exactly one correct', r.stdout)

    def test_build_checks_flows_and_links(self):
        work, git = pr_repo()
        d = work / 'd'
        (d / 'parts').mkdir(parents=True)
        (d / 'dive.json').write_text(json.dumps({'title': 'T', 'summary': 'S', 'source': {'kind': 'module', 'ref': '.'}, 'chapters': []}))
        code = lambda sid: {'kind': 'code', 'id': sid, 'title': sid, 'say': 'S', 'notes': [{'file': 'app.py', 'lines': [1, 1], 'text': 'x'}]}
        edge = {**flow('b'), 'kind': 'edge', 'title': 'Edge'}
        del edge['id']
        quiz = {'kind': 'quiz', 'title': 'Q', 'question': 'Q?', 'options': [
            {'text': 'a', 'why': 'w', 'correct': True}, {'text': 'b', 'why': 'w'}, {'text': 'c', 'why': 'w'}]}
        f1 = flow('b', 'a', 'nope')
        f1['actors'][0]['change'] = 'added'
        steps = [f1, code('a'), code('b'), code('lost'), quiz, edge, quiz, edge, edge]
        (d / 'parts' / 'walkthrough.1.json').write_text(json.dumps({'id': 'walkthrough', 'title': 'W', 'steps': steps}))
        (d / 'parts' / 'walkthrough.2.json').write_text(json.dumps({'id': 'walkthrough', 'steps': [code('a2'), flow(fid='f')]}))
        over = {**flow(), 'kind': 'sequence', 'messages': [{'from': 'a', 'to': 'a', 'label': 'l', 'note': 'n', 'step': 'zz'}]}
        over['actors'][0]['category'] = 'db'
        box = {'kind': 'diagram', 'title': 'D', 'say': 'S', 'nodes': [{'id': 'n', 'label': 'N'}, {'id': 'm', 'label': 'M'}],
               'edges': [], 'notes': [{'focus': ['n'], 'text': 't'}, {'text': 'no focus'}]}
        (d / 'parts' / 'big-picture.json').write_text(json.dumps({'id': 'big-picture', 'title': 'B', 'steps': [over, edge, box]}))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 1)
        self.assertNotIn('Traceback', r.stderr)
        for e in ['actor 1: "change" marks only belong in a PR dive',
                  'message 3: step "nope" is not a code step of this flow',
                  'walkthrough step 4 (code "lost"): no message of the flow links to it',
                  "flow 'Pay': code steps must follow the order of their first linking message",
                  "walkthrough step 7 (quiz 'Q'): only edge steps may follow an edge step",
                  'id "f" is used twice',
                  'message 1: step "zz" is not a flow id',
                  "big-picture step 1 (sequence 'Pay') actor 1: category must be one of person, service", "big-picture step 2 (edge 'Edge'): edge steps belong in walkthrough",
                  "big-picture step 3 (diagram 'D'): nodes ['m'] are in no note's focus",
                  "big-picture step 3 (diagram 'D') note 2: missing \"focus\""]:
            self.assertIn(e, r.stdout)

    def test_check_validates_one_part(self):
        work, git = pr_repo()
        d = work / 'd'
        (d / 'parts').mkdir(parents=True)
        (d / 'dive.json').write_text(json.dumps({'title': 'T', 'summary': 'S', 'source': {'kind': 'module', 'ref': '.'}, 'chapters': []}))
        over = {**flow(), 'kind': 'sequence', 'messages': [{'from': 'a', 'to': 'a', 'label': 'l', 'note': 'n', 'step': 'f'}]}
        part = d / 'parts' / 'big-picture.json'
        part.write_text(json.dumps({'id': 'big-picture', 'title': 'B', 'steps': [over]}))
        r = run(work, 'check', str(part))
        self.assertEqual(r.returncode, 0, r.stdout)  # the flow "f" is in another part
        quiz = {'kind': 'quiz', 'title': 'Q', 'question': 'Q?', 'options': [{'text': 'a', 'why': 'w', 'correct': True}]}
        part.write_text(json.dumps({'id': 'big-picture', 'title': 'B', 'steps': [over, quiz]}))
        r = run(work, 'check', str(part))
        self.assertEqual(r.returncode, 1)
        self.assertIn("big-picture step 2 (quiz 'Q'): needs 3-4 options", r.stdout)
        self.assertEqual(sorted(p.name for p in d.rglob('*')), ['big-picture.json', 'dive.json', 'parts'])

    def test_level(self):
        work = Path(tempfile.mkdtemp())
        sh(work, 'git', 'init', '-q')
        sh(work, 'git', 'config', 'user.name', 't')
        sh(work, 'git', 'config', 'user.email', 't@t')

        def commit(d, i, author='t <t@t>'):
            (work / d).mkdir(exist_ok=True)
            (work / d / 'f').write_text(str(i))
            sh(work, 'git', 'add', '.'); sh(work, 'git', 'commit', '-qm', 'c', '--author', author)

        for i in range(10): commit('a', i)
        commit('b', 0)
        for i in range(12): commit('b', i + 1, 'o <o@o>')
        self.assertIn('level=familiar\nreason=10 of your commits', sh(work, sys.executable, str(DIVE), 'level', 'a'))
        self.assertIn('level=new\nreason=1 of your commits', sh(work, sys.executable, str(DIVE), 'level', 'b'))


if __name__ == '__main__':
    unittest.main()
