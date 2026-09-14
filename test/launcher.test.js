// test/launcher.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStartArgs, resolveCmd } from '../server/launcher.js';

const CMD_FALLBACK = '/mnt/c/Windows/System32/cmd.exe';

test('resolveCmd: PATH 에 cmd.exe 가 있으면 그대로 사용', () => {
  const env = { PATH: '/usr/bin:/mnt/c/Windows/System32' };
  const existsSync = (p) => p === '/mnt/c/Windows/System32/cmd.exe';
  assert.equal(resolveCmd(env, existsSync), 'cmd.exe');
});

test('resolveCmd: PATH 에 없지만 표준 절대경로가 존재하면 폴백', () => {
  const env = { PATH: '/usr/bin:/usr/local/bin' }; // System32 없음
  const existsSync = (p) => p === CMD_FALLBACK; // PATH 후보엔 없고 폴백만 존재
  assert.equal(resolveCmd(env, existsSync), CMD_FALLBACK);
});

test('resolveCmd: PATH 에도 폴백에도 없으면 최후로 bare 이름', () => {
  const env = { PATH: '/usr/bin' };
  const existsSync = () => false;
  assert.equal(resolveCmd(env, existsSync), 'cmd.exe');
});

test('resolveCmd: PATH 비어도 throw 안 함', () => {
  assert.equal(resolveCmd({}, () => false), 'cmd.exe');
});

test('기본 형태: /c start "" wsl.exe 로 시작 (빈 문자열 = start 의 창 제목 자리)', () => {
  const a = buildStartArgs('Ubuntu-24.04', '/home/g/projects/todo', true);
  assert.deepEqual(a.slice(0, 4), ['/c', 'start', '', 'wsl.exe']);
});

test('런처 스크립트(launch-claude.sh)를 bash 로 호출', () => {
  const a = buildStartArgs('Ubuntu-24.04', '/home/g/projects/todo', false, '/x/scripts/launch-claude.sh');
  const i = a.indexOf('bash');
  assert.ok(i > 0);
  assert.equal(a[i + 1], '/x/scripts/launch-claude.sh');
});

test('cont=true 면 --continue 가 마지막 인자', () => {
  const a = buildStartArgs('Ubuntu-24.04', '/home/g/projects/todo', true, '/x/scripts/launch-claude.sh');
  assert.equal(a[a.length - 1], '--continue');
});

test('cont=false 면 --continue 없음', () => {
  const a = buildStartArgs('Ubuntu-24.04', '/home/g/projects/new', false, '/x/scripts/launch-claude.sh');
  assert.ok(!a.includes('--continue'));
  assert.equal(a[a.length - 1], '/x/scripts/launch-claude.sh');
});

test('distro 와 경로가 인자에 포함', () => {
  const a = buildStartArgs('Ubuntu-24.04', '/home/g/projects/todo', true);
  assert.equal(a[a.indexOf('-d') + 1], 'Ubuntu-24.04');
  assert.equal(a[a.indexOf('--cd') + 1], '/home/g/projects/todo');
});

test('공백·작은따옴표 경로도 인자 배열에 원형 그대로 (인용은 WSL interop 몫)', () => {
  const a = buildStartArgs('Ubuntu-24.04', "/home/g/projects/O'Brien my project", false);
  assert.equal(a[a.indexOf('--cd') + 1], "/home/g/projects/O'Brien my project");
});
