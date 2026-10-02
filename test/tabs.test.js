// test/tabs.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeTabs, readTabs, writeTabs, renameInTabs } from '../server/tabs.js';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tabs-')), 'sub', 'tabs.json');

test('readTabs: 파일 없음/깨짐 → 빈 상태', () => {
  const f = tmpFile();
  assert.deepEqual(readTabs(f), { tabs: [], assign: {} });
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'nope');
  assert.deepEqual(readTabs(f), { tabs: [], assign: {} });
});

test('writeTabs → readTabs 왕복, 이름 trim', () => {
  const f = tmpFile();
  const st = { tabs: [{ id: 't1', name: ' 공모전 ' }], assign: { a: 't1' } };
  assert.deepEqual(writeTabs(f, st), { ok: true });
  assert.deepEqual(readTabs(f), { tabs: [{ id: 't1', name: '공모전' }], assign: { a: 't1' } });
});

test('normalizeTabs: 없는 탭을 가리키는 배정은 버림', () => {
  assert.deepEqual(
    normalizeTabs({ tabs: [{ id: 't1', name: 'x' }], assign: { a: 't1', b: 'gone' } }),
    { tabs: [{ id: 't1', name: 'x' }], assign: { a: 't1' } },
  );
});

test('normalizeTabs: 형식 오류 → null (빈 이름, 중복 id, 배열 아님)', () => {
  assert.equal(normalizeTabs(null), null);
  assert.equal(normalizeTabs({ tabs: 'x' }), null);
  assert.equal(normalizeTabs({ tabs: [{ id: 't1', name: '  ' }] }), null);
  assert.equal(normalizeTabs({ tabs: [{ id: 't1', name: 'a' }, { id: 't1', name: 'b' }] }), null);
  assert.equal(writeTabs(tmpFile(), { tabs: 1 }).ok, false);
});

test('renameInTabs: 배정을 새 이름으로 옮김, 없으면 no-op', () => {
  const f = tmpFile();
  writeTabs(f, { tabs: [{ id: 't1', name: 'x' }], assign: { a: 't1' } });
  renameInTabs(f, 'a', 'aa');
  assert.deepEqual(readTabs(f).assign, { aa: 't1' });
  assert.deepEqual(renameInTabs(f, 'zz', 'y'), { ok: true });
});
