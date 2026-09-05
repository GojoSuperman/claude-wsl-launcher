// test/renamer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rename, parseGithubRepo } from '../server/renamer.js';
import { encode } from '../server/session.js';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rroot-'));
}
function setup(oldName = 'old-app', opts = {}) {
  const root = tmpRoot();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rhome-'));
  const full = path.join(root, oldName);
  fs.mkdirSync(full);
  if (opts.git !== false) {
    execFileSync('git', ['-C', full, 'init', '-q']);
    if (opts.remote) execFileSync('git', ['-C', full, 'remote', 'add', 'origin', opts.remote]);
  }
  if (opts.session) {
    const sdir = path.join(home, '.claude', 'projects', encode(full));
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, 'abc.jsonl'), '{}\n');
  }
  return { root, home, full };
}
const noGh = async () => ({ ok: true }); // gh 호출 스텁(성공)

test('parseGithubRepo: https/ssh/.git 변형 모두 owner/repo 추출', () => {
  assert.equal(parseGithubRepo('https://github.com/me/app.git'), 'me/app');
  assert.equal(parseGithubRepo('https://github.com/me/app'), 'me/app');
  assert.equal(parseGithubRepo('git@github.com:me/app.git'), 'me/app');
  assert.equal(parseGithubRepo('ssh://git@github.com/me/app.git'), 'me/app');
  assert.equal(parseGithubRepo('https://gitlab.com/me/app.git'), null);
  assert.equal(parseGithubRepo(''), null);
  assert.equal(parseGithubRepo(null), null);
});

test('로컬 폴더 이동 + 세션 폴더 이동, 원격 없으면 gh 미호출', async () => {
  const { root, home, full } = setup('old-app', { session: true });
  let called = false;
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', runGh: async () => { called = true; return { ok: true }; } });
  assert.equal(r.ok, true);
  assert.equal(r.path, path.join(root, 'new-app'));
  assert.equal(fs.existsSync(full), false);
  assert.equal(fs.existsSync(path.join(root, 'new-app')), true);
  assert.equal(fs.existsSync(path.join(home, '.claude', 'projects', encode(path.join(root, 'new-app')), 'abc.jsonl')), true);
  assert.equal(called, false);
  assert.equal(r.github, null);
});

test('GitHub origin 있으면 gh repo rename 호출, 결과 github 필드로', async () => {
  const { root, home } = setup('old-app', { remote: 'https://github.com/me/old-app.git' });
  let args = null;
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', runGh: async (a) => { args = a; return { ok: true }; } });
  assert.equal(r.ok, true);
  assert.deepEqual(args, ['repo', 'rename', 'new-app', '-R', 'me/old-app', '--yes']);
  assert.equal(r.github, 'me/new-app');
  assert.equal(r.warning, undefined);
  const url = execFileSync('git', ['-C', path.join(root, 'new-app'), 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  assert.equal(url, 'https://github.com/me/new-app.git');
});

test('gh 실패 → 로컬은 유지, ok:true + warning', async () => {
  const { root, home } = setup('old-app', { remote: 'git@github.com:me/old-app.git' });
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', runGh: async () => ({ ok: false, error: 'not logged in' }) });
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'new-app')), true);
  assert.match(r.warning, /not logged in/);
  assert.equal(r.github, null);
});

test('세션 폴더 없어도 ok', async () => {
  const { root, home } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', runGh: noGh });
  assert.equal(r.ok, true);
});

test('존재하지 않는 프로젝트 → unknown project', async () => {
  const { root, home } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'nope', newName: 'x', runGh: noGh });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown project/);
});

test('새 이름 invalid → invalid name, 폴더 그대로', async () => {
  const { root, home, full } = setup('old-app');
  for (const bad of ['', '..', 'a/b', 'a\\b']) {
    const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: bad, runGh: noGh });
    assert.equal(r.ok, false);
    assert.match(r.error, /invalid name/);
  }
  assert.equal(fs.existsSync(full), true);
});

test('새 이름 이미 존재 → already exists', async () => {
  const { root, home } = setup('old-app');
  fs.mkdirSync(path.join(root, 'taken'));
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'taken', runGh: noGh });
  assert.equal(r.ok, false);
  assert.match(r.error, /already exists/);
});

test('같은 이름 → already exists', async () => {
  const { root, home } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'old-app', runGh: noGh });
  assert.equal(r.ok, false);
  assert.match(r.error, /already exists/);
});

test('실행 중 프로젝트 → running, 이동 안 함', async () => {
  const { root, home, full } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'x', runGh: noGh, isRunning: () => true });
  assert.equal(r.ok, false);
  assert.match(r.error, /running/);
  assert.equal(fs.existsSync(full), true);
});
