// public/whats-new-logic.js
// '새 기능' 창에 자동으로 보여 줄 소식 고르기 (순수 함수 — 테스트 가능).
//   releases = 최신 먼저, id = 'YYYY-MM-DD'(같은 날 두 번이면 'YYYY-MM-DD-2') → 문자열 비교로 순서
//   seen = 마지막으로 [확인]한 소식 id | null(기록 없음)
//   hasProjects = 기록이 없을 때 기존 사용자(업데이트)인지 새 사용자(첫 설치)인지 가르는 기준

/** @returns 보여 줄 소식들(최신 먼저). 빈 배열이면 창을 띄우지 않는다. */
export function pickUnseen(releases, seen, hasProjects) {
  if (!releases.length) return [];
  if (!seen) return hasProjects ? [releases[0]] : [];
  return releases.filter((r) => r.id > seen);
}
