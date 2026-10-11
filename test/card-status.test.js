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

test('팀: 병합 끝 브랜치 → 팀 띠 + 할 말, GitHub 줄은 main 기준', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, role: 'member',
    sync: { ahead: 0, behind: 0, state: 'synced', branch: 'Bob-x', defaultBranch: 'main', mainBehind: 1, pr: { number: 4, state: 'MERGED' }, openPrs: null } });
  assert.equal(s.level, 'warn'); assert.equal(s.stripKey, 'stripBranchMerged'); assert.equal(s.hintKey, 'hintAfterMerge');
  assert.equal(s.githubKey, 'ghMainBehind'); assert.deepEqual(s.githubArgs, [1]);
  assert.equal(s.team, true); assert.equal(s.locked, false);
});

test('팀: 브랜치 GitHub 사본보다 뒤처짐 → 기존 받기 띠 그대로', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, role: 'member',
    sync: { ahead: 0, behind: 2, state: 'behind', branch: 'b', defaultBranch: 'main', mainBehind: 0, pr: null } });
  assert.equal(s.stripKey, 'stripBehind'); assert.equal(s.showPull, true);
});

test('팀 + upstream 없음: 확인 전에도 확인 버튼(잠금 없음), 확인 뒤 미업로드 띠', () => {
  const before = computeCardStatus({ isGit: true, hasUpstream: false, checked: false, role: 'member', sync: undefined });
  assert.equal(before.showCheck, true); assert.equal(before.locked, false); assert.equal(before.stripKey, 'stripTeamCheck'); // '바로 작업 가능' 금지
  const after = computeCardStatus({ isGit: true, hasUpstream: false, checked: true, role: 'member',
    sync: { ahead: 0, behind: 0, state: 'synced', branch: 'b', defaultBranch: 'main', mainBehind: 0, pr: null } });
  assert.equal(after.stripKey, 'stripBranchNotPushed'); assert.equal(after.githubKey, 'ghNoUpstream');
});

test('팀 + upstream 없음 + 기본 브랜치 모름 → 초록 아닌 추적 없음', () => {
  const s = computeCardStatus({ isGit: true, hasUpstream: false, checked: true, role: 'member',
    sync: { ahead: 0, behind: 0, state: 'synced', branch: 'b', defaultBranch: null, mainBehind: null, pr: null } });
  assert.equal(s.stripKey, 'stripNoUpstream'); assert.equal(s.showCheck, true);
});

test('개인(solo)·역할 모름은 기존과 같음', () => {
  for (const role of ['solo', undefined]) {
    const s = computeCardStatus({ isGit: true, hasUpstream: false, checked: false, role, sync: undefined });
    assert.equal(s.showCheck, false); assert.equal(s.team, false);
  }
});

test('팀: 확인 뒤 브랜치가 바뀌었으면(또는 받기 직후라 팀 정보가 없으면) 옛 띠 대신 다시 확인 권유', () => {
  const sync = { ahead: 0, behind: 0, state: 'synced', branch: 'main', defaultBranch: 'main', mainBehind: 0, pr: null, openPrs: 0 };
  const moved = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, role: 'member', branch: 'Bob-new', sync });
  assert.equal(moved.stripKey, 'stripTeamCheck'); assert.equal(moved.hintKey, null); assert.equal(moved.locked, false); assert.equal(moved.showCheck, true);
  const same = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, role: 'member', branch: 'main', sync });
  assert.equal(same.stripKey, 'stripOnMain');
  const afterPull = computeCardStatus({ isGit: true, hasUpstream: true, checked: true, role: 'member', branch: 'main', sync: { ahead: 0, behind: 0, state: 'synced' } });
  assert.equal(afterPull.stripKey, 'stripTeamCheck');
  // 개인 카드는 받기 직후에도 기존대로
  assert.equal(computeCardStatus({ isGit: true, hasUpstream: true, checked: true, role: 'solo', branch: 'main', sync: { ahead: 0, behind: 0, state: 'synced' } }).stripKey, 'stripSynced');
});
