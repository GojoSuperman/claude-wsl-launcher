// test/creator.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { create } from '../server/creator.js';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'croot-'));
}

test('정상 이름 → ok:true, 폴더 생성 + git init', () => {
  const root = tmpRoot();
  const r = create(root, 'new-app');
  assert.equal(r.ok, true);
  const full = path.join(root, 'new-app');
  assert.equal(fs.existsSync(full), true);
  assert.equal(fs.statSync(full).isDirectory(), true);
  const inside = execFileSync('git', ['-C', full, 'rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' }).trim();
  assert.equal(inside, 'true');
});

test('이미 존재하는 이름 → ok:false, already exists', () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, 'dup'));
  const r = create(root, 'dup');
  assert.equal(r.ok, false);
  assert.match(r.error, /already exists/);
});

test('잘못된 이름(..) → ok:false, invalid name, 아무것도 안 만듦', () => {
  const root = tmpRoot();
  const before = fs.readdirSync(root).length;
  const r = create(root, '..');
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid name/);
  assert.equal(fs.readdirSync(root).length, before);
});

test('잘못된 이름(슬래시) → ok:false, invalid name', () => {
  const root = tmpRoot();
  const r = create(root, 'a/b');
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid name/);
});

test('빈 이름 → ok:false, invalid name', () => {
  const root = tmpRoot();
  const r = create(root, '');
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid name/);
});

test('상대 projectsRoot → ok:false, invalid root', () => {
  const r = create('relative/root', 'app');
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid root/);
});

test('git 없는 환경 → 폴더는 생성, ok:true (git init 비치명적)', () => {
  const root = tmpRoot();
  const savedPath = process.env.PATH;
  process.env.PATH = '/nonexistent-bin'; // git 을 못 찾게
  try {
    const r = create(root, 'nogit');
    assert.equal(r.ok, true);
    assert.equal(fs.existsSync(path.join(root, 'nogit')), true);
  } finally {
    process.env.PATH = savedPath;
  }
});
