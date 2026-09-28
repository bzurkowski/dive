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
    git('add', '.'); git('commit', '-qm', 'pr'); git('push', '-q', 'origin', 'HEAD:refs/pull/1/head')
    git('reset', '-q', '--hard', 'HEAD~1')  # user's tree stays on base
    return work, git


def run(work, *a):
    return subprocess.run([sys.executable, str(DIVE), *a], cwd=work, capture_output=True, text=True)


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
        step = {'kind': 'code', 'title': 'Guard', 'say': 'A guard.', 'notes': [{'file': 'app.py', 'lines': [2, 9], 'text': 'x'}]}
        (d / 'parts' / 'walkthrough.json').write_text(json.dumps({'id': 'walkthrough', 'title': 'Walkthrough', 'steps': [step]}))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 1)
        self.assertIn('outside app.py', r.stdout)

        step['notes'][0]['lines'] = [2, 3]
        (d / 'parts' / 'walkthrough.json').write_text(json.dumps({'id': 'walkthrough', 'title': 'Walkthrough', 'steps': [step]}))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('Reading: 7 words, 1 code notes, about 1 min.', r.stdout)
        self.assertFalse((d / 'parts' / 'walkthrough.json').exists())

        html = (d / 'index.html').read_text()
        data = json.loads(re.search(r'<script id="dive-data" type="application/json">(.*?)</script>', html, re.S).group(1))
        self.assertEqual(data['chapters'][0]['id'], 'walkthrough')
        self.assertIn('+    if x < 0:', data['files']['app.py']['text'])
        self.assertEqual(len(data['source']['head']), 40)

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
        step = {'kind': 'code', 'title': 'T', 'say': 'S', 'notes': [note]}
        dive = {'title': 'T', 'summary': 'S', 'source': {'kind': 'module', 'ref': '.'},
                'chapters': [{'id': 'walkthrough', 'title': 'W', 'steps': [step]}]}
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run(work, 'build', str(d))
        self.assertIn('file not found: ../secret.txt', r.stdout)
        note['file'] = 'app.py'
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run(work, 'build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout)

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
