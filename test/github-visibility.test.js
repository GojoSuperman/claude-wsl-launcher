// test/github-visibility.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisibilityLookup, isValidNameWithOwner, normalizeVisibility } from '../server/github-visibility.js';

test('isValidNameWithOwner: owner/repo 만, - 시작 거부', () => {
  assert.equal(isValidNameWithOwner('me/app'), true);
  assert.equal(isValidNameWithOwner('me/app.js'), true);
  assert.equal(isValidNameWithOwner('-x/app'), false);
  assert.equal(isValidNameWithOwner('me'), false);
  assert.equal(isValidNameWithOwner('me/app/x'), false);
  assert.equal(isValidNameWithOwner(null), false);
});

test('normalizeVisibility: 대소문자 무시, 그 외 null', () => {
  assert.equal(normalizeVisibility('public'), 'PUBLIC');
  assert.equal(normalizeVisibility('PRIVATE\n'), 'PRIVATE');
  assert.equal(normalizeVisibility('weird'), null);
  assert.equal(normalizeVisibility(''), null);
});

test('조회 결과 캐시: TTL 안에는 runner 1회', async () => {
  let calls = 0; let clock = 0;
  const l = createVisibilityLookup({ runner: async () => { calls++; return 'PUBLIC'; }, ttlMs: 1000, now: () => clock });
  assert.equal(await l.get('me/app'), 'PUBLIC');
  assert.equal(await l.get('me/app'), 'PUBLIC');
  assert.equal(calls, 1);
  clock = 1001;
  assert.equal(await l.get('me/app'), 'PUBLIC');
  assert.equal(calls, 2);
});

test('runner 실패 → null, 30초만 캐시', async () => {
  let calls = 0; let clock = 0;
  const l = createVisibilityLookup({ runner: async () => { calls++; throw new Error('gh: not logged in'); }, ttlMs: 600_000, now: () => clock });
  assert.equal(await l.get('me/app'), null);
  assert.equal(await l.get('me/app'), null);
  assert.equal(calls, 1);
  clock = 31_000;
  assert.equal(await l.get('me/app'), null);
  assert.equal(calls, 2);
});

test('잘못된 이름은 runner 호출 없이 null', async () => {
  let calls = 0;
  const l = createVisibilityLookup({ runner: async () => { calls++; return 'PUBLIC'; } });
  assert.equal(await l.get('-evil/x'), null);
  assert.equal(calls, 0);
});

test('동시 요청은 하나로 합침', async () => {
  let calls = 0;
  const l = createVisibilityLookup({ runner: async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return 'PRIVATE'; } });
  const [a, b] = await Promise.all([l.get('me/app'), l.get('me/app')]);
  assert.equal(a, 'PRIVATE'); assert.equal(b, 'PRIVATE'); assert.equal(calls, 1);
});
