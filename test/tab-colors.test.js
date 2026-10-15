// test/tab-colors.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readColors, setColor, renameColor, removeColor, normalizeColor } from '../server/tab-colors.js';

const file = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tc-')), 'sub', 'tab-colors.json');

test('normalizeColor: #rrggbb(대소문자·#생략 허용) → 소문자 #rrggbb, 그 밖은 null', () => {
  assert.equal(normalizeColor('#FF8800'), '#ff8800');
  assert.equal(normalizeColor('8a2be2'), '#8a2be2');
  for (const bad of ['#fff', 'red', '#ff88001', '', null, undefined, 123, '#gg0000', '#ff8800;rm -rf']) assert.equal(normalizeColor(bad), null);
});

test('setColor/readColors: 저장·덮어쓰기·null 이면 지움, 잘못된 색은 거절', () => {
  const f = file();
  assert.deepEqual(readColors(f), {});
  assert.deepEqual(setColor(f, 'app', '#FF8800'), { ok: true, color: '#ff8800' });
  assert.deepEqual(readColors(f), { app: '#ff8800' });
  assert.deepEqual(setColor(f, 'app', null), { ok: true, color: null });
  assert.deepEqual(readColors(f), {});
  assert.deepEqual(setColor(f, 'app', 'red'), { ok: false, error: 'invalid color' });
  assert.deepEqual(setColor(f, '', '#ff8800'), { ok: false, error: 'invalid name' });
});

test('renameColor/removeColor: 이름 바꾸면 따라가고, 삭제하면 지워짐, 없으면 그대로', () => {
  const f = file();
  setColor(f, 'a', '#112233');
  renameColor(f, 'a', 'b');
  assert.deepEqual(readColors(f), { b: '#112233' });
  renameColor(f, 'zz', 'yy');
  removeColor(f, 'b');
  assert.deepEqual(readColors(f), {});
  removeColor(f, 'none');
});
