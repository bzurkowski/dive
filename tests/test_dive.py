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
        step = {'kind': 'code', 'title': 'Guard', 'say': 'A guard.', 'file': 'app.py', 'notes': [{'lines': [2, 9], 'text': 'x'}]}
        (d / 'parts' / 'happy-path.json').write_text(json.dumps({'id': 'happy-path', 'title': 'Happy path', 'steps': [step]}))
        r = run('build', str(d))
        self.assertEqual(r.returncode, 1)
        self.assertIn('outside app.py', r.stdout)

        step['notes'][0]['lines'] = [2, 3]
        (d / 'parts' / 'happy-path.json').write_text(json.dumps({'id': 'happy-path', 'title': 'Happy path', 'steps': [step]}))
        r = run('build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('util.py (+1 -0): in no step or card', r.stdout)
        self.assertNotIn('app.py:', r.stdout)
        self.assertFalse((d / 'parts' / 'happy-path.json').exists())

        html = (d / 'index.html').read_text()
        data = json.loads(re.search(r'<script id="dive-data" type="application/json">(.*?)</script>', html, re.S).group(1))
        self.assertEqual(data['chapters'][0]['id'], 'happy-path')
        self.assertIn('+    if x < 0:', data['files']['app.py']['text'])
        self.assertEqual(len(data['source']['head']), 40)

        # A card that lists a file covers its hunks that no note explains.
        dive = json.loads((d / 'dive.json').read_text())
        dive['chapters'][0]['steps'][0]['notes'][0]['lines'] = [1, 1]
        dive['chapters'].append({'id': 'recap', 'title': 'Recap', 'steps': [{'kind': 'card', 'title': 'Also changed', 'body': '- `app.py`\n- `util.py`'}]})
        (d / 'dive.json').write_text(json.dumps(dive))
        r = run('build', str(d))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertNotIn('hunk in no note', r.stdout)
        self.assertNotIn('in no step or card', r.stdout)


if __name__ == '__main__':
    unittest.main()
