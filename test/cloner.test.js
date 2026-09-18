// test/cloner.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { clone, deriveName } from '../server/cloner.js';

test('deriveName: url 끝에서 repo 추출', () => {
  assert.equal(deriveName('https://github.com/u/repo.git'), 'repo');
  assert.equal(deriveName('https://github.com/u/repo'), 'repo');
  assert.equal(deriveName('git@github.com:u/repo.git'), 'repo');
});

test('clone: 상대경로 root 거부', async () => {
  assert.deepEqual(await clone('rel', 'https://x/y.git'), { ok: false, error: 'invalid root' });
});

test('clone: 잘못된 url 거부 (- 시작/공백)', async () => {
  const r1 = await clone('/tmp', '-oProxyCommand=evil');
  assert.equal(r1.ok, false); assert.equal(r1.error, 'invalid url');
  const r2 = await clone('/tmp', 'not a url');
  assert.equal(r2.ok, false); assert.equal(r2.error, 'invalid url');
});

test('clone: 로컬 bare repo 를 file:// 로 clone (네트워크 없음)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-test-'));
  try {
    const src = path.join(tmp, 'src.git');
    execFileSync('git', ['init', '--bare', '-q', '-b', 'main', src]);
    const work = path.join(tmp, 'work');
    execFileSync('git', ['clone', '-q', src, work]);
    fs.writeFileSync(path.join(work, 'a.txt'), 'hi');
    execFileSync('git', ['-C', work, 'add', '.']);
    execFileSync('git', ['-C', work, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
    execFileSync('git', ['-C', work, 'push', '-q', 'origin', 'HEAD:main']);

    const root = path.join(tmp, 'projects');
    fs.mkdirSync(root);
    const r = await clone(root, `file://${src}`, 'mine');
    assert.equal(r.ok, true);
    assert.equal(r.name, 'mine');
    assert.ok(fs.existsSync(path.join(root, 'mine', 'a.txt')));

    const dup = await clone(root, `file://${src}`, 'mine');
    assert.deepEqual(dup, { ok: false, error: 'already exists' });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
