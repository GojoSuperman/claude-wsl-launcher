// test/paths.test.js
import { isGithubSafeName, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveProject, isValidName } from '../server/paths.js';

function tmpRootWith(dirs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
  for (const d of dirs) fs.mkdirSync(path.join(root, d));
  return root;
}

test('정상 이름 → 절대경로 반환', () => {
  const root = tmpRootWith(['todo']);
  assert.equal(resolveProject(root, 'todo'), path.join(root, 'todo'));
});

test('존재하지 않는 이름 → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, 'ghost'), null);
});

test('슬래시 포함 → null', () => {
  const root = tmpRootWith(['a']);
  assert.equal(resolveProject(root, 'a/b'), null);
});

test('.. 포함 → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, '..'), null);
});

test('빈 문자열 → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, ''), null);
});

test('파일(디렉토리 아님) → null', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
  fs.writeFileSync(path.join(root, 'file.txt'), 'x');
  assert.equal(resolveProject(root, 'file.txt'), null);
});

test('백슬래시 포함 → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, 'a\\b'), null);
});

test('NUL 포함 → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, 'valid\x00'), null);
});

test('단일 점(.) → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, '.'), null);
});

test('projectsRoot 가 상대경로면 → null', () => {
  assert.equal(resolveProject('relative/root', 'anything'), null);
});

test('개행(\\n, \\r) 포함 → null', () => {
  const root = tmpRootWith([]);
  assert.equal(resolveProject(root, 'a\nb'), null);
  assert.equal(resolveProject(root, 'a\rb'), null);
});

test('isValidName: 정상 이름 → true', () => {
  assert.equal(isValidName('todo'), true);
  assert.equal(isValidName('my-app_2'), true);
});

test('isValidName: 빈값/구분자/.. /개행/NUL → false', () => {
  assert.equal(isValidName(''), false);
  assert.equal(isValidName('a/b'), false);
  assert.equal(isValidName('a\\b'), false);
  assert.equal(isValidName('..'), false);
  assert.equal(isValidName('.'), false);
  assert.equal(isValidName('a\nb'), false);
  assert.equal(isValidName('a\rb'), false);
  assert.equal(isValidName('x\x00'), false);
  assert.equal(isValidName(null), false);
});

test('isGithubSafeName: 영문·숫자·-_. 만 허용, 한글/공백/특수문자 거부', () => {
  for (const ok of ['tower-defender', 'my_app.v2', 'A1']) assert.equal(isGithubSafeName(ok), true, ok);
  for (const bad of ['보고서분석', 'my app', 'a/b', '..', '', 'app!', 'café']) assert.equal(isGithubSafeName(bad), false, bad);
});
