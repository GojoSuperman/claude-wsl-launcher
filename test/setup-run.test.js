// test/setup-run.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

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

test('setup.sh --yes: 비대화형으로 후보 폴더를 자동 선택하고 설정 파일에 기록', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'shome-'));
  fs.mkdirSync(path.join(home, 'dev', 'a', '.git'), { recursive: true });
  fs.mkdirSync(path.join(home, 'dev', 'b', '.git'), { recursive: true });
  const xdg = path.join(home, '.config');
  const r = spawnSync('bash', [SETUP, '--yes'], {
    encoding: 'utf8',
    input: '',
    env: { ...process.env, HOME: home, XDG_CONFIG_HOME: xdg, DOCTOR_DRY_RUN: '', SETUP_NO_SHORTCUT: '1' },
  });
  assert.ok(r.stdout.includes('[자동] 저장소가 가장 많은 1) 선택'), '자동 선택 문구');
  const cfg = JSON.parse(fs.readFileSync(path.join(xdg, 'project-launcher', 'config.json'), 'utf8'));
  assert.equal(cfg.projectsRoot, path.join(home, 'dev'));
});
