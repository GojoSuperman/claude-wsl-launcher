// test/team-status.test.js — 2026-10-11 team-test 테스트에서 실제로 나온 장면들
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTeamStatus } from '../public/team-status.js';

const member = { role: 'member', branch: 'Bob-member-role-update', defaultBranch: 'main', hasUpstream: true, upBehind: 0, mainBehind: 0, pr: null, openPrs: null };

test('팀 아님(solo·readonly·null) → null', () => {
  for (const role of ['solo', 'readonly', null]) assert.equal(computeTeamStatus({ ...member, role }), null);
});

test('1) 내 PR 충돌 → action + 해결 할 말', () => {
  const r = computeTeamStatus({ ...member, mainBehind: 2, pr: { number: 4, state: 'OPEN', mergeable: 'CONFLICTING' } });
  assert.deepEqual(r, { level: 'action', stripKey: 'stripPrConflict', stripArg: 4, hintKey: 'hintPrConflict', hintArg: 4 });
});

test('2) 이 브랜치 PR 병합됨 (테스트 마지막 장면: main 대비 0/1) → 병합 끝', () => {
  const r = computeTeamStatus({ ...member, mainBehind: 1, pr: { number: 4, state: 'MERGED', mergeable: 'UNKNOWN' } });
  assert.deepEqual(r, { level: 'warn', stripKey: 'stripBranchMerged', hintKey: 'hintAfterMerge' });
});

test('3) 브랜치 GitHub 사본보다 뒤처짐 → null(기존 받기), 단 충돌·병합이 우선', () => {
  assert.equal(computeTeamStatus({ ...member, upBehind: 2, mainBehind: 3 }), null);
  assert.equal(computeTeamStatus({ ...member, upBehind: 2, pr: { number: 4, state: 'MERGED' } }).stripKey, 'stripBranchMerged');
});

test('4) 작업 브랜치 + main 에 새 커밋 → 반영 권장', () => {
  assert.deepEqual(computeTeamStatus({ ...member, mainBehind: 2 }), { level: 'warn', stripKey: 'stripMainAhead', stripArg: 2, hintKey: 'hintMergeMain' });
});

test('5) 작업 브랜치 미업로드 → 아직 안 올림 (빈 새 브랜치에 "병합 끝" 금지)', () => {
  const fresh = { ...member, branch: 'Bob-new', hasUpstream: false, pr: null, mainBehind: 0 };
  assert.deepEqual(computeTeamStatus(fresh), { level: 'warn', stripKey: 'stripBranchNotPushed', hintKey: null });
});

test('6) 내 PR 열림(충돌 계산 중 UNKNOWN 포함) → 검토 대기', () => {
  for (const mergeable of ['MERGEABLE', 'UNKNOWN']) {
    assert.deepEqual(computeTeamStatus({ ...member, pr: { number: 4, state: 'OPEN', mergeable } }),
      { level: 'info', stripKey: 'stripPrWaiting', stripArg: 4, hintKey: null });
  }
});

test('7) 팀장 + 검토 대기 PR → 리뷰 안내 (main 에 있어도 이것이 우선)', () => {
  const leader = { ...member, role: 'leader', branch: 'main', openPrs: 2 };
  assert.deepEqual(computeTeamStatus(leader), { level: 'info', stripKey: 'stripReviewWaiting', stripArg: 2, hintKey: 'hintReview' });
});

test('8) 기본 브랜치에 있음 → 새 작업은 브랜치에서 (팀원, 대기 PR 없는 팀장)', () => {
  const want = { level: 'warn', stripKey: 'stripOnMain', hintKey: 'hintNewBranch' };
  assert.deepEqual(computeTeamStatus({ ...member, branch: 'main' }), want);
  assert.deepEqual(computeTeamStatus({ ...member, role: 'leader', branch: 'main', openPrs: 0 }), want);
});

test('9) 작업 브랜치, 아무 일 없음 → null(기존 같아요) / 닫힌 PR 은 무시', () => {
  assert.equal(computeTeamStatus(member), null);
  assert.equal(computeTeamStatus({ ...member, pr: { number: 2, state: 'CLOSED' } }), null);
});

test('기본 브랜치를 모르면 main 기준 안내를 추측하지 않음', () => {
  const unknown = { ...member, defaultBranch: null, hasUpstream: false, mainBehind: 0 };
  assert.equal(computeTeamStatus(unknown), null);
  assert.equal(computeTeamStatus({ ...unknown, branch: 'main' }), null);
  // PR 기반 판단은 기본 브랜치 없이도 됨
  assert.equal(computeTeamStatus({ ...unknown, pr: { number: 4, state: 'MERGED' } }).stripKey, 'stripBranchMerged');
});
