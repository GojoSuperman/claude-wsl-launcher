// test/whats-new.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pickUnseen } from '../public/whats-new-logic.js';
import { readSeen, writeSeen, userHistory } from '../server/whats-new.js';

const R = [{ id: '2026-11-02' }, { id: '2026-10-20' }, { id: '2026-10-11' }]; // 최신 먼저

test('pickUnseen: 마지막으로 본 것보다 새 소식만(최신 먼저), 다 봤으면 없음', () => {
  assert.deepEqual(pickUnseen(R, '2026-10-11', true).map((r) => r.id), ['2026-11-02', '2026-10-20']);
  assert.deepEqual(pickUnseen(R, '2026-10-20', true).map((r) => r.id), ['2026-11-02']);
  assert.deepEqual(pickUnseen(R, '2026-11-02', true), []);
});

test('pickUnseen: 기록 없음 — 기존 사용자(프로젝트 있음)는 최신 소식 하나, 새 사용자는 없음', () => {
  assert.deepEqual(pickUnseen(R, null, true).map((r) => r.id), ['2026-11-02']);
  assert.deepEqual(pickUnseen(R, null, false), []);
});

test('pickUnseen: 목록에 없는 옛 기록이면 그보다 새 것만, 소식 목록이 비면 없음', () => {
  assert.deepEqual(pickUnseen(R, '2026-01-01', true).map((r) => r.id), ['2026-11-02', '2026-10-20', '2026-10-11']);
  assert.deepEqual(pickUnseen([], null, true), []);
});

test('readSeen/writeSeen: 없으면 null, 쓰면 읽힘, 깨진 파일은 null', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wn-')), 'sub', 'whats-new.json');
  assert.equal(readSeen(f), null);
  assert.deepEqual(writeSeen(f, '2026-10-11'), { ok: true });
  assert.equal(readSeen(f), '2026-10-11');
  fs.writeFileSync(f, '{broken');
  assert.equal(readSeen(f), null);
  assert.equal(writeSeen(f, '').ok, false);
});

test('userHistory: 프로젝트가 없어도 런처를 써 온 흔적(메모·순서·탭·계정·예전 설정)이 있으면 기존 사용자', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wnu-'));
  const home = path.join(base, 'home'); const stateDir = path.join(base, 'state'); const cfgDir = path.join(base, 'cfg');
  const projectsRoot = path.join(home, 'projects');
  fs.mkdirSync(projectsRoot, { recursive: true }); fs.mkdirSync(stateDir); fs.mkdirSync(cfgDir);
  const configFile = path.join(cfgDir, 'config.json');
  const args = { stateDir, configFile, home, projectsRoot, envRoot: undefined, hasProjects: false };
  assert.deepEqual(userHistory(args), { existing: false, legacyRoot: null });
  assert.deepEqual(userHistory({ ...args, hasProjects: true }), { existing: true, legacyRoot: null });
  fs.writeFileSync(path.join(stateDir, 'server.log'), ''); // 로그만 있으면(첫 실행) 새 사용자
  assert.equal(userHistory(args).existing, false);
  fs.writeFileSync(path.join(stateDir, 'order.json'), '{}');
  assert.equal(userHistory(args).existing, true);
});

test('userHistory: 예전에 바꿔 쓰던 스캔 폴더(설정 파일, 또는 무시된 /mnt 환경변수)를 알려 준다 — 실제로 있을 때만', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wnl-'));
  const home = path.join(base, 'home'); const stateDir = path.join(base, 'state');
  const projectsRoot = path.join(home, 'projects'); const old = path.join(home, 'work');
  fs.mkdirSync(projectsRoot, { recursive: true }); fs.mkdirSync(old); fs.mkdirSync(stateDir);
  const configFile = path.join(base, 'config.json');
  const args = { stateDir, configFile, home, projectsRoot, envRoot: undefined, hasProjects: false };
  fs.writeFileSync(configFile, JSON.stringify({ projectsRoot: '~/work' }));
  assert.deepEqual(userHistory(args), { existing: true, legacyRoot: old });
  fs.writeFileSync(configFile, JSON.stringify({ projectsRoot: '~/projects/' }));
  assert.deepEqual(userHistory(args), { existing: true, legacyRoot: null }, '기본 폴더와 같으면 안내 없음');
  fs.writeFileSync(configFile, JSON.stringify({ projectsRoot: '~/gone' }));
  assert.equal(userHistory(args).legacyRoot, null, '없어진 폴더는 안내 안 함');
  fs.rmSync(configFile);
  assert.deepEqual(userHistory({ ...args, envRoot: old }), { existing: false, legacyRoot: null }, 'WSL 경로 환경변수는 그대로 쓰이므로 안내 대상 아님');
  const win = path.join(base, 'mnt-like');
  fs.mkdirSync(win);
  assert.equal(userHistory({ ...args, envRoot: win, isWindows: () => true }).legacyRoot, win);
});
