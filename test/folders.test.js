// test/folders.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listDir, candidates } from '../server/folders.js';

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-'));
  const mk = (p) => fs.mkdirSync(path.join(home, p), { recursive: true });
  mk('dev/a/.git'); mk('dev/b/.git'); mk('dev/c'); mk('work/x/.git'); mk('projects');
  mk('.hidden/h/.git'); mk('dev/a/node_modules/m/.git'); mk('single/.git');
  fs.writeFileSync(path.join(home, 'dev', 'file.txt'), '');
  return home;
}

test('listDir: 하위 폴더만, 숨김·node_modules 제외, 저장소 여부·개수', () => {
  const home = fakeHome();
  const r = listDir(path.join(home, 'dev'));
  assert.equal(r.ok, true);
  assert.equal(r.parent, home);
  assert.deepEqual(r.entries.map((e) => [e.name, e.isRepo, e.repos]), [['a', true, 0], ['b', true, 0], ['c', false, 0]]);
  const top = listDir(home);
  assert.deepEqual(top.entries.map((e) => [e.name, e.repos]), [['dev', 2], ['projects', 0], ['single', 0], ['work', 1]]);
});

test('listDir: 루트의 parent 는 null, 상대경로/없음/파일은 오류', () => {
  assert.equal(listDir('/').parent, null);
  assert.equal(listDir('relative').error, 'not absolute');
  assert.equal(listDir('/definitely/not/here').error, 'not found');
  const home = fakeHome();
  assert.equal(listDir(path.join(home, 'dev', 'file.txt')).error, 'not a directory');
});

test('candidates: 저장소를 품은 폴더를 개수 내림차순, 자기 자신이 저장소면 제외', () => {
  const home = fakeHome();
  assert.deepEqual(candidates(home), [{ path: path.join(home, 'dev'), repos: 2 }, { path: path.join(home, 'work'), repos: 1 }]);
  assert.deepEqual(candidates('relative'), []);
});
