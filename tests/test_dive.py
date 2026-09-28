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


class DiveTest(unittest.TestCase):
    def test_prep_and_build(self):
        tmp = Path(tempfile.mkdtemp())
        origin, work = tmp / 'origin.git', tmp / 'work'
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

        run = lambda *a: subprocess.run([sys.executable, str(DIVE), *a], cwd=work, capture_output=True, text=True)
        d = work / 'docs' / 'dives' / 'pr-1'
        r = run('prep', str(d), '--pr', 'https://github.com/o/r/pull/1')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual([f['path'] for f in json.loads((d / 'diff.json').read_text())['files']], ['app.py', 'util.py'])

        (d / 'dive.json').write_text(json.dumps({'title': 'T', 'summary': 'S', 'source': {'kind': 'pr', 'ref': '1'}, 'chapters': []}))
        (d / 'parts').mkdir()
        step = {'kind': 'code', 'title': 'Guard', 'say': 'A guard.', 'notes': [{'file': 'app.py', 'lines': [2, 9], 'text': 'x'}]}
        (d / 'parts' / 'happy-path.json').write_text(json.dumps({'id': 'happy-path', 'title': 'Happy path', 'steps': [step]}))
        r = run('build', str(d))
        self.assertEqual(r.returncode, 1)
        self.assertIn('outside app.py', r.stdout)

        step['notes'][0]['lines'] = [2, 3]
        (d / 'parts' / 'happy-path.json').write_text(json.dumps({'id': 'happy-path', 'title': 'Happy path', 'steps': [step]}))
        r = run('build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('Reading: 8 words, 1 code notes, about 1 min.', r.stdout)
        self.assertFalse((d / 'parts' / 'happy-path.json').exists())

        html = (d / 'index.html').read_text()
        data = json.loads(re.search(r'<script id="dive-data" type="application/json">(.*?)</script>', html, re.S).group(1))
        self.assertEqual(data['chapters'][0]['id'], 'happy-path')
        self.assertIn('+    if x < 0:', data['files']['app.py']['text'])
        self.assertEqual(len(data['source']['head']), 40)

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
