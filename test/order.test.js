// test/order.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readOrder, writeOrder, renameInOrder } from '../server/order.js';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'order-')), 'sub', 'order.json');

test('readOrder: 파일 없음/깨짐/배열아님 → []', () => {
  const f = tmpFile();
  assert.deepEqual(readOrder(f), []);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, '{broken');
  assert.deepEqual(readOrder(f), []);
  fs.writeFileSync(f, '{"a":1}');
  assert.deepEqual(readOrder(f), []);
});

test('writeOrder → readOrder 왕복, 중복 제거, 디렉토리 자동 생성', () => {
  const f = tmpFile();
  assert.deepEqual(writeOrder(f, ['b', 'a', 'b']), { ok: true });
  assert.deepEqual(readOrder(f), ['b', 'a']);
});

test('writeOrder: 빈 배열 = 파일 삭제(이름순 복귀)', () => {
  const f = tmpFile();
  writeOrder(f, ['a']);
  assert.deepEqual(writeOrder(f, []), { ok: true });
  assert.equal(fs.existsSync(f), false);
  assert.deepEqual(writeOrder(f, []), { ok: true }); // 없어도 OK
});

test('writeOrder: 잘못된 입력 거부', () => {
  const f = tmpFile();
  assert.equal(writeOrder(f, 'a').ok, false);
  assert.equal(writeOrder(f, ['a', 3]).ok, false);
  assert.equal(writeOrder(f, ['']).ok, false);
});

test('renameInOrder: 같은 자리 유지, 없으면 no-op', () => {
  const f = tmpFile();
  writeOrder(f, ['a', 'b', 'c']);
  renameInOrder(f, 'b', 'bb');
  assert.deepEqual(readOrder(f), ['a', 'bb', 'c']);
  assert.deepEqual(renameInOrder(f, 'zz', 'y'), { ok: true });
  assert.deepEqual(readOrder(f), ['a', 'bb', 'c']);
});
