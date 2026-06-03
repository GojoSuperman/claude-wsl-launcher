// test/doctor-run.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DOCTOR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'doctor.sh');

test('doctor.sh: 실행되어 헤더를 출력하고 종료코드 0/1', () => {
  const r = spawnSync('bash', [DOCTOR], { encoding: 'utf8' });
  assert.ok(r.stdout.includes('프로젝트 런처 셋업 점검'), '헤더 출력');
  assert.ok(r.status === 0 || r.status === 1, `종료코드 0/1 (실제 ${r.status})`);
});
