// test/launch-claude.test.js
// launch-claude.sh 를 가짜 claude 로 실행해 환경변수·인자·탭 제목을 잰다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.join(import.meta.dirname, '..', 'scripts', 'launch-claude.sh');

function run(args, { apiKey = 'sk-test-dummy' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-'));
  const home = path.join(root, 'home');
  const proj = path.join(root, 'my-proj');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.mkdirSync(proj);
  fs.mkdirSync(bin);
  const out = path.join(root, 'out.txt');
  // 가짜 claude: 받은 환경·인자를 파일에 남긴다. 끝의 `exec bash -i` 는 stdin 이 비어 바로 끝난다.
  fs.writeFileSync(path.join(bin, 'claude'),
    `#!/bin/sh\necho "CFG=\${CLAUDE_CONFIG_DIR:-}" > "${out}"\necho "KEY=\${ANTHROPIC_API_KEY:-}" >> "${out}"\necho "TITLEOFF=\${CLAUDE_CODE_DISABLE_TERMINAL_TITLE:-}" >> "${out}"\necho "ARGS=$*" >> "${out}"\n`,
    { mode: 0o755 });
  const r = spawnSync('bash', [SCRIPT, ...args], {
    cwd: proj, input: '', encoding: 'utf8',
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, ANTHROPIC_API_KEY: apiKey, NVM_DIR: path.join(root, 'no-nvm') },
  });
  const rec = Object.fromEntries(fs.readFileSync(out, 'utf8').trim().split('\n').map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
  const titles = [...r.stdout.matchAll(/\x1b\]0;([^\x07]*)\x07/g)].map((m) => m[1]);
  return { rec, titles, stdout: r.stdout };
}

test('기본 계정: 환경 그대로, 탭 제목 = 폴더 이름', () => {
  const { rec, titles } = run([]);
  assert.equal(rec.CFG, '');
  assert.equal(rec.KEY, 'sk-test-dummy');
  assert.equal(rec.TITLEOFF, '1');
  assert.equal(rec.ARGS, '');
  assert.deepEqual(titles, ['my-proj']);
});

test('추가 계정: CLAUDE_CONFIG_DIR 지정, API 키 제거, 탭 제목에 계정 이름, --continue 전달', () => {
  const { rec, titles } = run(['--account', '/tmp/acct x', '--label', '수업용 · a@b.com', '--continue']);
  assert.equal(rec.CFG, '/tmp/acct x');
  assert.equal(rec.KEY, '');
  assert.equal(rec.ARGS, '--continue');
  assert.deepEqual(titles, ['my-proj · 수업용 · a@b.com']);
});

test('기본 계정 + 라벨(계정이 여러 개일 때): 환경 그대로, 제목에만 이름', () => {
  const { rec, titles } = run(['--label', '개인']);
  assert.equal(rec.CFG, '');
  assert.equal(rec.KEY, 'sk-test-dummy');
  assert.deepEqual(titles, ['my-proj · 개인']);
});
