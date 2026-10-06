// test/renamer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rename } from '../server/renamer.js';
import { encode } from '../server/session.js';
import { readAll, setNote, renameNote } from '../server/notes.js';

function setup(oldName = 'old-app', opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rroot-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rhome-'));
  const full = path.join(root, oldName);
  fs.mkdirSync(full);
  execFileSync('git', ['-C', full, 'init', '-q']);
  if (opts.remote) execFileSync('git', ['-C', full, 'remote', 'add', 'origin', opts.remote]);
  if (opts.session) {
    const sdir = path.join(home, '.claude', 'projects', encode(full));
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, 'abc.jsonl'), '{}\n');
  }
  const notesFile = path.join(home, 'notes.json');
  if (opts.note) setNote(notesFile, oldName, opts.note);
  return { root, home, full, notesFile };
}
const okRepo = async () => ({ ok: true });

test('renameNote: 키 이동, 없으면 no-op', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rn-')), 'n.json');
  setNote(f, 'a', '메모');
  assert.deepEqual(renameNote(f, 'a', 'b'), { ok: true });
  assert.deepEqual(readAll(f), { b: '메모' });
  assert.deepEqual(renameNote(f, 'zzz', 'y'), { ok: true });
  assert.deepEqual(readAll(f), { b: '메모' });
});

test('로컬 폴더 + 세션 폴더 + 메모 이동, 원격 없으면 gh 미호출', async () => {
  const { root, home, full, notesFile } = setup('old-app', { session: true, note: '설명' });
  let called = false;
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', notesFile, renameRepo: async () => { called = true; return { ok: true }; } });
  assert.equal(r.ok, true);
  assert.equal(r.path, path.join(root, 'new-app'));
  assert.equal(fs.existsSync(full), false);
  assert.equal(fs.existsSync(path.join(root, 'new-app')), true);
  assert.equal(fs.existsSync(path.join(home, '.claude', 'projects', encode(path.join(root, 'new-app')), 'abc.jsonl')), true);
  assert.deepEqual(readAll(notesFile), { 'new-app': '설명' });
  assert.equal(called, false);
  assert.equal(r.github, null);
});

test('GitHub origin 있으면 renameRepo(owner/repo, newName) 호출 → github 필드', async () => {
  const { root, home } = setup('old-app', { remote: 'https://github.com/me/old-app.git' });
  let args = null;
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', renameRepo: async (repo, nn) => { args = [repo, nn]; return { ok: true }; } });
  assert.equal(r.ok, true);
  assert.deepEqual(args, ['me/old-app', 'new-app']);
  assert.equal(r.github, 'me/new-app');
  assert.equal(r.warning, undefined);
  const url = execFileSync('git', ['-C', path.join(root, 'new-app'), 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  assert.equal(url, 'https://github.com/me/new-app.git');
});

test('gh 실패 → 로컬은 유지, ok:true + warning', async () => {
  const { root, home } = setup('old-app', { remote: 'git@github.com:me/old-app.git' });
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', renameRepo: async () => ({ ok: false, error: 'not logged in' }) });
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(path.join(root, 'new-app')), true);
  assert.match(r.warning, /not logged in/);
  assert.equal(r.github, null);
});

test('세션·메모 없어도 ok', async () => {
  const { root, home } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'new-app', renameRepo: okRepo });
  assert.equal(r.ok, true);
});

test('존재하지 않는 프로젝트 → unknown project', async () => {
  const { root, home } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'nope', newName: 'x', renameRepo: okRepo });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown project/);
});

test('새 이름 invalid → invalid name, 폴더 그대로', async () => {
  const { root, home, full } = setup('old-app');
  for (const bad of ['', '..', 'a/b', 'a\\b']) {
    const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: bad, renameRepo: okRepo });
    assert.equal(r.ok, false);
    assert.match(r.error, /invalid name/);
  }
  assert.equal(fs.existsSync(full), true);
});

test('새 이름 이미 존재/같은 이름 → already exists', async () => {
  const { root, home } = setup('old-app');
  fs.mkdirSync(path.join(root, 'taken'));
  assert.match((await rename({ projectsRoot: root, home, name: 'old-app', newName: 'taken', renameRepo: okRepo })).error, /already exists/);
  assert.match((await rename({ projectsRoot: root, home, name: 'old-app', newName: 'old-app', renameRepo: okRepo })).error, /already exists/);
});

test('실행 중 프로젝트 → running, 이동 안 함', async () => {
  const { root, home, full } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'x', renameRepo: okRepo, isRunning: () => true });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'running');
  assert.equal(fs.existsSync(full), true);
});

test('대시보드 서버 자신의 폴더 → self, 이동 안 함', async () => {
  const { root, home, full } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: 'x', renameRepo: okRepo, isSelf: () => true });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'self');
  assert.equal(fs.existsSync(full), true);
});

test('한글 새 이름 → ascii only, 폴더 그대로', async () => {
  const { root, home, full } = setup('old-app');
  const r = await rename({ projectsRoot: root, home, name: 'old-app', newName: '보고서분석', renameRepo: okRepo });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'ascii only');
  assert.equal(fs.existsSync(full), true);
});
