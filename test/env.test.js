// test/env.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectEnv } from '../server/env.js';

test('WSL_DISTRO_NAME 있으면 그것을 사용', () => {
  const env = detectEnv(
    { WSL_DISTRO_NAME: 'Ubuntu-24.04', HOME: '/home/g', USER: 'g' },
    () => 'FALLBACK'
  );
  assert.equal(env.distro, 'Ubuntu-24.04');
  assert.equal(env.home, '/home/g');
  assert.equal(env.user, 'g');
  assert.equal(env.projectsRoot, '/home/g/projects');
});

test('WSL_DISTRO_NAME 없으면 fallback 사용', () => {
  const env = detectEnv({ HOME: '/home/g', USER: 'g' }, () => 'Ubuntu-26.04');
  assert.equal(env.distro, 'Ubuntu-26.04');
});

test('distro 를 끝내 못 구하면 throw', () => {
  assert.throws(() => detectEnv({ HOME: '/home/g', USER: 'g' }, () => ''));
});

test('PROJECTS_ROOT 미설정 → 기본 $HOME/projects', () => {
  const env = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g' });
  assert.equal(env.projectsRoot, '/home/g/projects');
});

test('PROJECTS_ROOT 절대경로 → 그대로 사용', () => {
  const env = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g', PROJECTS_ROOT: '/home/g/dev' });
  assert.equal(env.projectsRoot, '/home/g/dev');
});

test('PROJECTS_ROOT ~ 확장 (~ 및 ~/sub)', () => {
  assert.equal(
    detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g', PROJECTS_ROOT: '~' }).projectsRoot,
    '/home/g'
  );
  assert.equal(
    detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g', PROJECTS_ROOT: '~/work' }).projectsRoot,
    '/home/g/work'
  );
});

test('PROJECTS_ROOT 상대경로 → 홈 기준으로 해석', () => {
  const env = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g', PROJECTS_ROOT: 'repos' });
  assert.equal(env.projectsRoot, '/home/g/repos');
});

test('PROJECTS_ROOT 공백/빈 문자열 → 기본값', () => {
  const env = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g', PROJECTS_ROOT: '   ' });
  assert.equal(env.projectsRoot, '/home/g/projects');
});

test('설정 파일의 projectsRoot 가 기본값보다 우선, 환경변수는 설정보다 우선', () => {
  const cfg = () => ({ projectsRoot: '~/work' });
  const a = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g' }, () => '', cfg);
  assert.equal(a.projectsRoot, '/home/g/work');
  assert.equal(a.projectsRootSource, 'config');
  const b = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g', PROJECTS_ROOT: '/srv/x' }, () => '', cfg);
  assert.equal(b.projectsRoot, '/srv/x');
  assert.equal(b.projectsRootSource, 'env');
  const c = detectEnv({ WSL_DISTRO_NAME: 'd', HOME: '/home/g', USER: 'g' }, () => '', () => ({}));
  assert.equal(c.projectsRoot, '/home/g/projects');
  assert.equal(c.projectsRootSource, 'default');
});
