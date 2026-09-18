// test/gh-error.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGhError } from '../server/github.js';

test('gh 미설치(spawn ENOENT) → gh-missing', () => {
  assert.equal(classifyGhError('spawn gh ENOENT'), 'gh-missing');
  assert.equal(classifyGhError('Error: spawn gh ENOENT'), 'gh-missing');
});

test('gh 있으나 로그인 안 됨 → gh-auth', () => {
  const real = 'To get started with GitHub CLI, please run:  gh auth login\n'
    + 'Alternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.';
  assert.equal(classifyGhError(real), 'gh-auth');
});

test('인증 만료/토큰 문제도 gh-auth', () => {
  assert.equal(classifyGhError('error: authentication token expired'), 'gh-auth');
  assert.equal(classifyGhError('HTTP 401: Bad credentials'), 'gh-auth');
});

test('네트워크 문제 → gh-network', () => {
  assert.equal(classifyGhError('dial tcp: lookup api.github.com: no such host'), 'gh-network');
  assert.equal(classifyGhError('error connecting to api.github.com'), 'gh-network');
});

test('분류 안 되는 것은 null (원문을 그대로 보여주게)', () => {
  assert.equal(classifyGhError('something entirely unexpected'), null);
  assert.equal(classifyGhError(''), null);
  assert.equal(classifyGhError(undefined), null);
});

test('gh-missing 판정이 gh-auth 보다 우선 (둘 다 매치될 여지가 있어도)', () => {
  // ENOENT 메시지에 'gh auth login' 문구가 섞여 들어와도 미설치가 먼저다
  assert.equal(classifyGhError('spawn gh ENOENT — please run: gh auth login'), 'gh-missing');
});
