// test/notes.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAll, setNote } from '../server/notes.js';

// sub/ 를 일부러 포함 → dir 자동생성도 검증
function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'));
  return path.join(dir, 'sub', 'notes.json');
}

test('readAll: 없는 파일 → {}', () => {
  assert.deepEqual(readAll(tmpFile()), {});
});

test('readAll: 깨진 JSON → {}', () => {
  const f = tmpFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, 'not json{');
  assert.deepEqual(readAll(f), {});
});

test('setNote: 추가/수정 후 readAll 에 반영(+dir 자동생성)', () => {
  const f = tmpFile();
  assert.deepEqual(setNote(f, 'church-accounting', '교회 회계'), { ok: true });
  assert.equal(readAll(f)['church-accounting'], '교회 회계');
  setNote(f, 'church-accounting', '교회 회계 시스템');
  assert.equal(readAll(f)['church-accounting'], '교회 회계 시스템');
});

test('setNote: 빈값/공백 → 키 삭제', () => {
  const f = tmpFile();
  setNote(f, 'a', '메모');
  setNote(f, 'a', '   ');
  assert.equal('a' in readAll(f), false);
});

test('setNote: trim 적용', () => {
  const f = tmpFile();
  setNote(f, 'a', '  메모  ');
  assert.equal(readAll(f).a, '메모');
});

test('setNote: 빈 name 거부', () => {
  assert.deepEqual(setNote(tmpFile(), '', 'x'), { ok: false, error: 'invalid name' });
});
