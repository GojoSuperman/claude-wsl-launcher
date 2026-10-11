// public/team-status.js
// 팀 프로젝트 카드의 띠·"claude 에게 할 말" 결정 (순수 함수 → node:test 와 브라우저 공용).
// 설계: docs/superpowers/specs/2026-10-11-팀-프로젝트-표시-design.md 2.2 우선순위.
// null = 팀 아님, 또는 기존 띠(받기·같아요)를 그대로 쓴다.
import { isTeamRole } from './team-role.js';

export function computeTeamStatus(s) {
  if (!s || !isTeamRole(s.role)) return null;
  const pr = s.pr || null;
  const known = !!s.defaultBranch; // 기본 브랜치를 알아야 main 기준 안내를 한다
  const onDefault = known && s.branch === s.defaultBranch;
  const onWork = known && !onDefault;

  if (pr && pr.state === 'OPEN' && pr.mergeable === 'CONFLICTING') {
    return { level: 'action', stripKey: 'stripPrConflict', stripArg: pr.number, hintKey: 'hintPrConflict', hintArg: pr.number };
  }
  if (pr && pr.state === 'MERGED' && !onDefault) {
    return { level: 'warn', stripKey: 'stripBranchMerged', hintKey: 'hintAfterMerge' };
  }
  if (s.hasUpstream && s.upBehind > 0) return null; // 기존 '받기'
  if (onWork && s.mainBehind > 0) {
    return { level: 'warn', stripKey: 'stripMainAhead', stripArg: s.mainBehind, hintKey: 'hintMergeMain' };
  }
  if (onWork && !s.hasUpstream) {
    return { level: 'warn', stripKey: 'stripBranchNotPushed', hintKey: null };
  }
  if (pr && pr.state === 'OPEN') {
    return { level: 'info', stripKey: 'stripPrWaiting', stripArg: pr.number, hintKey: null };
  }
  if (s.role === 'leader' && s.openPrs > 0) {
    return { level: 'info', stripKey: 'stripReviewWaiting', stripArg: s.openPrs, hintKey: 'hintReview' };
  }
  if (onDefault) return { level: 'warn', stripKey: 'stripOnMain', hintKey: 'hintNewBranch' };
  return null;
}
