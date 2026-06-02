// test/scanner.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { list } from '../server/scanner.js';

test('디렉토리만, 숨김/파일 제외, 정렬', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
  fs.mkdirSync(path.join(root, 'beta'));
  fs.mkdirSync(path.join(root, 'alpha'));
  fs.mkdirSync(path.join(root, '.hidden'));
  fs.writeFileSync(path.join(root, 'readme.txt'), 'x');

  const names = list(root).map((p) => p.name);
  assert.deepEqual(names, ['alpha', 'beta']);
});

test('각 항목은 name 과 path 를 가진다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
  fs.mkdirSync(path.join(root, 'todo'));
  const items = list(root);
  assert.equal(items[0].name, 'todo');
  assert.equal(items[0].path, path.join(root, 'todo'));
});

test('루트가 없으면 빈 배열', () => {
  assert.deepEqual(list('/nonexistent/path/xyz'), []);
});

test('디렉토리를 가리키는 심볼릭 링크도 포함', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'target-'));
  fs.symlinkSync(target, path.join(root, 'linked-project'));
  const names = list(root).map((p) => p.name);
  assert.deepEqual(names, ['linked-project']);
});
