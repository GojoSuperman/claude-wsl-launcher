// server/config.js
// 경로 문자열 정규화(PROJECTS_ROOT 환경변수·가져오기 경로). 절대 throw 안 함.
import path from 'node:path';

/**
 * 사용자가 입력한 스캔 폴더 문자열을 절대경로로 정규화 (순수).
 * '~' / '~/x' / 절대 / 홈 기준 상대. 빈값 → null.
 */
export function normalizeRoot(raw, home) {
  const s = (raw || '').toString().trim();
  if (!s) return null;
  if (s === '~') return home;
  if (s.startsWith('~/')) return path.join(home, s.slice(2));
  if (path.isAbsolute(s)) return path.normalize(s);
  return path.join(home, s);
}
