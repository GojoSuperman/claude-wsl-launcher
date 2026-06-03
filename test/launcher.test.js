// test/launcher.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPsScript, resolvePowershell } from '../server/launcher.js';

const PS_FALLBACK = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

test('resolvePowershell: PATH 에 powershell.exe 가 있으면 그대로 사용', () => {
  const env = { PATH: '/usr/bin:/mnt/c/Windows/System32/WindowsPowerShell/v1.0' };
  const existsSync = (p) => p === '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
  assert.equal(resolvePowershell(env, existsSync), 'powershell.exe');
});

test('resolvePowershell: PATH 에 없지만 표준 절대경로가 존재하면 폴백', () => {
  const env = { PATH: '/usr/bin:/usr/local/bin' }; // System32 없음
  const existsSync = (p) => p === PS_FALLBACK; // PATH 후보엔 없고 폴백만 존재
  assert.equal(resolvePowershell(env, existsSync), PS_FALLBACK);
});

test('resolvePowershell: PATH 에도 폴백에도 없으면 최후로 bare 이름', () => {
  const env = { PATH: '/usr/bin' };
  const existsSync = () => false;
  assert.equal(resolvePowershell(env, existsSync), 'powershell.exe');
});

test('resolvePowershell: PATH 비어도 throw 안 함', () => {
  assert.equal(resolvePowershell({}, () => false), 'powershell.exe');
});

test('기본 형태: Start-Process wsl.exe -ArgumentList 로 시작', () => {
  const s = buildPsScript('Ubuntu-24.04', '/home/g/projects/todo', true);
  assert.ok(s.startsWith("Start-Process wsl.exe -ArgumentList "));
});

test('런처 스크립트(launch-claude.sh)를 bash 로 호출', () => {
  const s = buildPsScript('Ubuntu-24.04', '/home/g/projects/todo', false, '/x/scripts/launch-claude.sh');
  assert.ok(s.includes("'bash','/x/scripts/launch-claude.sh'"));
});

test('cont=true 면 --continue 인자 포함', () => {
  const s = buildPsScript('Ubuntu-24.04', '/home/g/projects/todo', true, '/x/scripts/launch-claude.sh');
  assert.ok(s.includes("'bash','/x/scripts/launch-claude.sh','--continue'"));
});

test('cont=false 면 --continue 없음', () => {
  const s = buildPsScript('Ubuntu-24.04', '/home/g/projects/new', false, '/x/scripts/launch-claude.sh');
  assert.ok(s.includes("'bash','/x/scripts/launch-claude.sh'"));
  assert.ok(!s.includes('--continue'));
});

test('distro 와 경로가 인자에 포함', () => {
  const s = buildPsScript('Ubuntu-24.04', '/home/g/projects/todo', true);
  assert.ok(s.includes("'-d','Ubuntu-24.04'"));
  assert.ok(s.includes("'--cd','/home/g/projects/todo'"));
});

test("작은따옴표 들어간 경로는 '' 로 이스케이프", () => {
  const s = buildPsScript('Ubuntu-24.04', "/home/g/projects/O'Brien", true);
  assert.ok(s.includes("'--cd','/home/g/projects/O''Brien'"));
});

test('경로에 공백이 있으면 단일인용으로 올바르게 감싸짐', () => {
  const s = buildPsScript('Ubuntu-24.04', '/home/g/projects/my project', false);
  assert.ok(s.includes("'--cd','/home/g/projects/my project'"));
});

test("distro 에 작은따옴표가 있으면 '' 로 이스케이프", () => {
  const s = buildPsScript("Ubuntu'test", '/home/g/projects/foo', false);
  assert.ok(s.includes("'-d','Ubuntu''test'"));
});
