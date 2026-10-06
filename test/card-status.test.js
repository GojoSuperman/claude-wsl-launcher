// test/card-status.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCardStatus } from '../public/card-status.js';

test('git 아님 → none, 띠 없음, 잠금 없음', () => {
  const s = computeCardStatus({ isGit: false, hasUpstream: false, checked: false, sync: undefined });
  assert.equal(s.level, 'none'); assert.equal(s.stripKey, null);
  assert.equal(s.locked, false); assert.equal(s.showCheck, false); assert.equal(s.githubKey, null);
});

test('upstream 없음 → muted, 추적 없음 안내', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: false, checked: false, sync: undefined });
  assert.equal(s.level, 'muted'); assert.equal(s.stripKey, 'stripNoUpstream');
  assert.equal(s.locked, false); assert.equal(s.showCheck, false); assert.equal(s.githubKey, 'ghNoUpstream');
});

test('upstream + 미확인 → action, 잠금, 확인 버튼', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: false, sync: undefined });
  assert.equal(s.level, 'action'); assert.equal(s.stripKey, 'stripCheck');
  assert.equal(s.locked, true); assert.equal(s.showCheck, true); assert.equal(s.githubKey, 'ghNotChecked');
});

test('확인 + 최신 → ok', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, sync: { ahead: 0, behind: 0, state: 'synced' } });
  assert.equal(s.level, 'ok'); assert.equal(s.stripKey, 'stripSynced');
  assert.equal(s.locked, false); assert.equal(s.showPull, false); assert.equal(s.githubKey, 'upToDate');
});

test('확인 + 뒤짐 → action, 받기 버튼', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, sync: { ahead: 0, behind: 3, state: 'behind' } });
  assert.equal(s.level, 'action'); assert.equal(s.stripKey, 'stripBehind'); assert.equal(s.stripArg, 3);
  assert.equal(s.showPull, true); assert.deepEqual(s.githubArgs, [3]); assert.equal(s.githubKey, 'behind');
});

test('확인 + 앞섬 → warn', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, sync: { ahead: 2, behind: 0, state: 'ahead' } });
  assert.equal(s.level, 'warn'); assert.equal(s.stripKey, 'stripAhead'); assert.equal(s.stripArg, 2);
  assert.equal(s.showPull, false); assert.equal(s.githubKey, 'ahead');
});

test('확인 + 갈라짐 → action', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, sync: { ahead: 2, behind: 4, state: 'diverged' } });
  assert.equal(s.level, 'action'); assert.equal(s.stripKey, 'stripDiverged');
  assert.equal(s.githubKey, 'diverged'); assert.deepEqual(s.githubArgs, [2, 4]);
});

test('확인 + 실패 → muted, 잠금 해제', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, sync: { failed: true } });
  assert.equal(s.level, 'muted'); assert.equal(s.stripKey, 'stripFailed');
  assert.equal(s.locked, false); assert.equal(s.githubKey, 'ghCheckFailed');
});

test('upstream 인데 showCheck 는 항상 true (재확인 가능)', () => {
  for (const sync of [undefined, { ahead: 0, behind: 0, state: 'synced' }, { failed: true }]) {
    assert.equal(computeCardStatus({ isGit: true, hasUpstream: true, checked: !!sync, sync }).showCheck, true);
  }
});
