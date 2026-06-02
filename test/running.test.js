// test/running.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runningPaths, isRunning } from '../server/running.js';

// 가짜 /proc 트리 구성 헬퍼
function fakeProc(entries) {
  // entries: [{ pid, comm, cwd }]  (cwd 생략 시 cwd 심볼릭 링크 미생성)
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-'));
  for (const e of entries) {
    const d = path.join(root, String(e.pid));
    fs.mkdirSync(d, { recursive: true });
    if (e.comm !== undefined) fs.writeFileSync(path.join(d, 'comm'), e.comm + '\n');
    if (e.cwd !== undefined) fs.symlinkSync(e.cwd, path.join(d, 'cwd'));
  }
  // 숫자 아닌 항목도 하나 (무시돼야 함)
  fs.mkdirSync(path.join(root, 'self'), { recursive: true });
  return root;
}

test('runningPaths: comm=claude 인 pid 의 cwd 만 수집', () => {
  const A = fs.mkdtempSync(path.join(os.tmpdir(), 'projA-'));
  const B = fs.mkdtempSync(path.join(os.tmpdir(), 'projB-'));
  const proc = fakeProc([
    { pid: 101, comm: 'claude', cwd: A },
    { pid: 102, comm: 'node', cwd: B },   // claude 아님 → 제외
    { pid: 103, comm: 'claude', cwd: B },
  ]);
  const set = runningPaths(proc);
  assert.equal(set.has(A), true);
  assert.equal(set.has(B), true);   // 103 이 claude
  assert.equal(set.size, 2);
});

test('runningPaths: cwd 없는 pid(종료 중) 는 건너뜀', () => {
  const A = fs.mkdtempSync(path.join(os.tmpdir(), 'projA2-'));
  const proc = fakeProc([
    { pid: 201, comm: 'claude' },          // cwd 링크 없음
    { pid: 202, comm: 'claude', cwd: A },
  ]);
  const set = runningPaths(proc);
  assert.equal(set.has(A), true);
  assert.equal(set.size, 1);
});

test('runningPaths: 숫자 아닌 항목(self) 무시', () => {
  const proc = fakeProc([]);  // self 만 존재
  const set = runningPaths(proc);
  assert.equal(set.size, 0);
});

test('runningPaths: 존재하지 않는 procRoot → 빈 Set (throw 안 함)', () => {
  const set = runningPaths('/nonexistent/proc/xyz');
  assert.equal(set.size, 0);
});

test('isRunning: 정확히 같은 경로 → true', () => {
  const set = new Set(['/home/g/projects/todo']);
  assert.equal(isRunning(set, '/home/g/projects/todo'), true);
});

test('isRunning: 하위 cwd → true', () => {
  const set = new Set(['/home/g/projects/todo/src']);
  assert.equal(isRunning(set, '/home/g/projects/todo'), true);
});

test('isRunning: 무관한 경로 → false', () => {
  const set = new Set(['/home/g/projects/other']);
  assert.equal(isRunning(set, '/home/g/projects/todo'), false);
});

test('isRunning: 접두사만 같고 형제 폴더 → false', () => {
  const set = new Set(['/home/g/projects/todo-e-book']);
  assert.equal(isRunning(set, '/home/g/projects/todo'), false);
});

test('isRunning: 빈 Set → false', () => {
  assert.equal(isRunning(new Set(), '/home/g/projects/todo'), false);
});

test('runningPaths: 실제 /proc 스모크 — throw 없이 Set 반환', () => {
  const set = runningPaths('/proc');
  assert.ok(set instanceof Set); // 값 단언 없음 (라이브 프로세스 가변)
});
