// test/github-visibility.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVisibilityLookup, isValidNameWithOwner, normalizeVisibility, setVisibility } from '../server/github-visibility.js';

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

test('setVisibility: runner 에 owner/repo + 소문자 visibility 전달', async () => {
  let args = null;
  const r = await setVisibility('me/app', 'private', async (...a) => { args = a; });
  assert.deepEqual(r, { ok: true, visibility: 'PRIVATE' });
  assert.deepEqual(args, ['me/app', 'private']);
});

test('setVisibility: 잘못된 repo/visibility 는 runner 미호출', async () => {
  let calls = 0;
  const run = async () => { calls++; };
  assert.match((await setVisibility('-x/app', 'public', run)).error, /invalid repo/);
  assert.match((await setVisibility('me/app', 'internal', run)).error, /invalid visibility/);
  assert.match((await setVisibility('me/app', 'weird', run)).error, /invalid visibility/);
  assert.equal(calls, 0);
});

test('setVisibility: runner 실패 → ok:false + stderr 메시지', async () => {
  const r = await setVisibility('me/app', 'PUBLIC', async () => { const e = new Error('x'); e.stderr = 'HTTP 403: admin required'; throw e; });
  assert.equal(r.ok, false);
  assert.match(r.error, /403/);
});

test('invalidate: 캐시 지우면 다음 get 이 runner 재호출', async () => {
  let calls = 0;
  const l = createVisibilityLookup({ runner: async () => { calls++; return 'PUBLIC'; } });
  await l.get('me/app'); await l.get('me/app');
  assert.equal(calls, 1);
  l.invalidate('me/app');
  await l.get('me/app');
  assert.equal(calls, 2);
});
