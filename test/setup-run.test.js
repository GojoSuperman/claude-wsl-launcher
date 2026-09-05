// test/setup-run.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SETUP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'setup.sh');

test('setup.sh: dry-run 으로 doctor → 의존성 → 단축키 생략 순서로 돌고 종료코드 0/1', () => {
  const r = spawnSync('bash', [SETUP], {
    encoding: 'utf8',
    input: '', // 모든 [Y/N] 은 Enter(=아니요)
    env: { ...process.env, DOCTOR_DRY_RUN: '1', SETUP_NO_SHORTCUT: '1' },
  });
  assert.ok(r.stdout.includes('Claude WSL Launcher 설치 (setup)'), '헤더');
  assert.ok(r.stdout.includes('프로젝트 런처 셋업 점검'), 'doctor 호출됨');
  assert.ok(r.stdout.includes('단축키 생략 (SETUP_NO_SHORTCUT)'), '단축키 생략');
  assert.ok(r.status === 0 || r.status === 1, `종료코드 0/1 (실제 ${r.status})`);
  // 실제 변경을 일으키는 명령이 실행되지 않았는지(드라이런): RUN> 로만 표시되거나 아예 없음
  assert.ok(!r.stdout.includes('added') && !r.stdout.includes('단축키 생성 중'), '실제 설치/단축키 미실행');
});
