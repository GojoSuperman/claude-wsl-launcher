// public/sync-classify.js
// 원격 동기 상태 분류 (순수 함수, DOM 의존 없음 → node:test 로 검증).
export function classify(ahead, behind) {
  if (behind > 0 && ahead > 0) return 'diverged';
  if (behind > 0) return 'behind';
  if (ahead > 0) return 'ahead';
  return 'synced';
}
