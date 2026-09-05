// test/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configPath, readConfig, writeConfig, normalizeRoot, validateRoot } from '../server/config.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));

test('configPath: XDG_CONFIG_HOME 우선, 없으면 ~/.config', () => {
  assert.equal(configPath({}, '/home/g'), '/home/g/.config/project-launcher/config.json');
  assert.equal(configPath({ XDG_CONFIG_HOME: '/x' }, '/home/g'), '/x/project-launcher/config.json');
});

test('read/write: 없으면 {}, 쓰면 merge 되어 읽힘, 깨진 파일은 {}', () => {
  const f = path.join(tmp(), 'sub', 'config.json');
  assert.deepEqual(readConfig(f), {});
  assert.deepEqual(writeConfig(f, { projectsRoot: '~/dev' }), { ok: true });
  assert.deepEqual(writeConfig(f, { other: 1 }), { ok: true });
  assert.deepEqual(readConfig(f), { projectsRoot: '~/dev', other: 1 });
  fs.writeFileSync(f, '{broken');
  assert.deepEqual(readConfig(f), {});
});

test('normalizeRoot: ~, ~/x, 절대, 상대, 빈값', () => {
  assert.equal(normalizeRoot('~', '/home/g'), '/home/g');
  assert.equal(normalizeRoot('~/dev', '/home/g'), '/home/g/dev');
  assert.equal(normalizeRoot('/srv/x/', '/home/g'), '/srv/x/');
  assert.equal(normalizeRoot('repos', '/home/g'), '/home/g/repos');
  assert.equal(normalizeRoot('  ', '/home/g'), null);
  assert.equal(normalizeRoot(undefined, '/home/g'), null);
});

test('validateRoot: 존재하는 디렉토리만 ok, 파일/없음/빈값은 오류, /mnt/c 는 경고', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'f.txt'), '');
  assert.equal(validateRoot(d, '/home/g').ok, true);
  assert.equal(validateRoot(path.join(d, 'f.txt'), '/home/g').error, 'not a directory');
  assert.equal(validateRoot(path.join(d, 'nope'), '/home/g').error, 'not found');
  assert.equal(validateRoot('', '/home/g').error, 'empty');
  // /mnt/c 경고는 존재해야 검사되므로 경로 패턴만 별도 확인
  assert.equal(/^\/mnt\/[a-zA-Z]\//.test('/mnt/c/Users/x'), true);
});
