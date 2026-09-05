// test/find-projects-root.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'find-projects-root.sh');

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fhome-'));
  const repo = (p) => { fs.mkdirSync(path.join(home, p, '.git'), { recursive: true }); };
  repo('dev/a'); repo('dev/b'); repo('dev/c');           // dev: 3
  repo('work/x');                                        // work: 1
  fs.mkdirSync(path.join(home, 'projects'));             // 비어 있음 → 후보 아님
  repo('.hidden/h');                                     // 숨김 → 제외
  fs.mkdirSync(path.join(home, 'dev', 'a', 'node_modules', 'm', '.git'), { recursive: true }); // 제외
  repo('single');                                        // 홈 직속 저장소 자체 → 후보 아님
  return home;
}

test('git 저장소를 품은 폴더를 저장소 수 내림차순으로 출력', () => {
  const home = fakeHome();
  const r = spawnSync('bash', [SCRIPT, home], { encoding: 'utf8' });
  const lines = r.stdout.trim().split('\n');
  assert.deepEqual(lines, [`3\t${path.join(home, 'dev')}`, `1\t${path.join(home, 'work')}`]);
});

test('후보 없으면 빈 출력', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fhome-'));
  fs.mkdirSync(path.join(home, 'projects'));
  const r = spawnSync('bash', [SCRIPT, home], { encoding: 'utf8' });
  assert.equal(r.stdout.trim(), '');
});
