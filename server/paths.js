// server/paths.js
import fs from 'node:fs';
import path from 'node:path';

/**
 * 프로젝트 이름으로 안전한지 (순수). 빈값/구분자/'.'/'..'/NUL/개행 거부.
 * resolveProject(존재해야 함)와 creator.create(없어야 함)가 공유.
 * @param {string} name
 * @returns {boolean}
 */
export function isValidName(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') return false;
  if (name.includes('\0') || name.includes('\n') || name.includes('\r')) return false;
  return true;
}

/**
 * name 을 검증하고 <projectsRoot>/<name> 절대경로를 반환. 위반 시 null.
 * - name 에 path 구분자/..  금지, 빈 문자열 금지
 * - 결과가 projectsRoot 직속이어야 하고 실제 디렉토리여야 함
 */
export function resolveProject(projectsRoot, name) {
  // projectsRoot 가 비정상(null/상대경로)이면 안전하게 null (throw 방지, 계약 명시)
  if (typeof projectsRoot !== 'string' || !path.isAbsolute(projectsRoot)) return null;
  if (!isValidName(name)) return null;

  const full = path.join(projectsRoot, name);
  // 직속 자식인지 (재구성 후에도 부모가 정확히 root)
  if (path.dirname(full) !== path.resolve(projectsRoot)) return null;

  try {
    // statSync 는 심링크를 따라감 — 허용: localhost 전용, 사용자 소유 fs
    if (!fs.statSync(full).isDirectory()) return null;
  } catch {
    return null;
  }
  return full;
}
