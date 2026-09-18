// test/deleter.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { trashLocal } from '../server/deleter.js';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'droot-'));
}

test('정상: resolveProject 통과 → runner 를 full 경로로 호출, ok:true', async () => {
  const root = tmpRoot();
  const full = path.join(root, 'app');
  fs.mkdirSync(full);
  let called = null;
  const r = await trashLocal(root, 'app', async (p) => { called = p; });
  assert.equal(r.ok, true);
  assert.equal(r.method, 'gio-trash');
  assert.equal(called, full);
});

test('잘못된 이름(..) → unknown project, runner 미호출', async () => {
  const root = tmpRoot();
  let called = false;
  const r = await trashLocal(root, '..', async () => { called = true; });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown project/);
  assert.equal(called, false);
});

test('존재하지 않는 프로젝트 → unknown project', async () => {
  const root = tmpRoot();
  const r = await trashLocal(root, 'nope', async () => {});
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown project/);
});

test('runner 실패 → ok:false, error 전달(영구삭제 폴백 없음)', async () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, 'app'));
  const r = await trashLocal(root, 'app', async () => { throw new Error('gio boom'); });
  assert.equal(r.ok, false);
  assert.match(r.error, /gio boom/);
  assert.equal(fs.existsSync(path.join(root, 'app')), true);
});
