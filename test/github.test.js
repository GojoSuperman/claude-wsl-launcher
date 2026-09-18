// test/github.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepos, isValidNameWithOwner, cloneRepo, deleteRepo, mapDeleteError } from '../server/github.js';

test('parseRepos: updatedAt 내림차순 정렬', () => {
  const json = JSON.stringify([
    { name: 'a', nameWithOwner: 'u/a', visibility: 'PUBLIC', url: 'x', updatedAt: '2026-01-01T00:00:00Z' },
    { name: 'b', nameWithOwner: 'u/b', visibility: 'PRIVATE', url: 'y', updatedAt: '2026-06-01T00:00:00Z' },
  ]);
  assert.deepEqual(parseRepos(json, []).map((r) => r.name), ['b', 'a']);
});

test('parseRepos: imported 표시', () => {
  const json = JSON.stringify([{ name: 'a', updatedAt: '2026-01-01T00:00:00Z' }]);
  assert.equal(parseRepos(json, ['a'])[0].imported, true);
  assert.equal(parseRepos(json, ['z'])[0].imported, false);
});

test('parseRepos: 깨진/배열아님 입력 → 빈 배열', () => {
  assert.deepEqual(parseRepos('not json', []), []);
  assert.deepEqual(parseRepos('{"x":1}', []), []);
});

test('isValidNameWithOwner', () => {
  assert.equal(isValidNameWithOwner('octocat/Hello_World'), true);
  assert.equal(isValidNameWithOwner('owner/repo.name-1'), true);
  assert.equal(isValidNameWithOwner('-evil/repo'), false);
  assert.equal(isValidNameWithOwner('norepo'), false);
  assert.equal(isValidNameWithOwner('a/b/c'), false);
  assert.equal(isValidNameWithOwner(''), false);
});

test('cloneRepo: 잘못된 repo 거부 (gh 호출 전)', async () => {
  assert.deepEqual(await cloneRepo('/tmp', 'norepo'), { ok: false, error: 'invalid repo' });
  assert.deepEqual(await cloneRepo('/tmp', '-evil/x'), { ok: false, error: 'invalid repo' });
});

test('cloneRepo: 상대경로 root 거부 (gh 호출 전)', async () => {
  assert.deepEqual(await cloneRepo('rel', 'owner/repo'), { ok: false, error: 'invalid root' });
});

test('deleteRepo: 잘못된 repo 거부 (gh 호출 전)', async () => {
  assert.deepEqual(await deleteRepo('norepo'), { ok: false, error: 'invalid repo' });
  assert.deepEqual(await deleteRepo('-evil/x'), { ok: false, error: 'invalid repo' });
});

test('mapDeleteError: 스코프/403 → 친절 안내, 그 외 → 원문', () => {
  assert.match(mapDeleteError('error: needs the "delete_repo" scope'), /gh auth refresh -s delete_repo/);
  assert.match(mapDeleteError('HTTP 403: Must have admin rights'), /gh auth refresh -s delete_repo/);
  assert.equal(mapDeleteError('  some other error  '), 'some other error');
  assert.equal(mapDeleteError(''), 'gh repo delete 실패');
});
