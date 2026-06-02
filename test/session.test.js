// test/session.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encode, hasSession } from '../server/session.js';

test('encode: /,_,. 를 - 로 치환', () => {
  assert.equal(
    encode('/home/user/projects/my_app.v2'),
    '-home-user-projects-my-app-v2'
  );
});

test('encode: 점(.) 도 - 로 치환', () => {
  assert.equal(encode('/a/b.c'), '-a-b-c');
});

test('hasSession: .jsonl 있으면 true', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const proj = '/home/x/projects/foo';
  const dir = path.join(home, '.claude', 'projects', encode(proj));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'abc.jsonl'), '{}');
  assert.equal(hasSession(home, proj), true);
});

test('hasSession: 디렉토리 없으면 false', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  assert.equal(hasSession(home, '/home/x/projects/none'), false);
});

test('hasSession: 디렉토리는 있지만 .jsonl 없으면 false', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const proj = '/home/x/projects/empty';
  fs.mkdirSync(path.join(home, '.claude', 'projects', encode(proj)), { recursive: true });
  assert.equal(hasSession(home, proj), false);
});

test('hasSession: .jsonl 아닌 파일만 있으면 false', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  const proj = '/home/x/projects/nonjsonl';
  const dir = path.join(home, '.claude', 'projects', encode(proj));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'notes.txt'), '');
  assert.equal(hasSession(home, proj), false);
});
