// public/team-role.js
// GitHub 저장소 정보 → 내 역할 (순수 함수, DOM/네트워크 무의존 → node:test 와 브라우저 공용).
// leader(팀장) / member(팀원) / readonly(읽기 전용) / solo(개인) / null(정보 없음)
const PUSH = new Set(['WRITE', 'MAINTAIN']);

export function computeRole(info) {
  if (!info || !info.me || !info.permission || !info.owner) return null;
  const mine = String(info.owner).toLowerCase() === String(info.me).toLowerCase();
  if (mine) return info.collaborators > 1 ? 'leader' : 'solo'; // 협업자 수는 나 포함
  if (info.permission === 'ADMIN') return info.ownerType === 'Organization' ? 'leader' : 'member';
  if (PUSH.has(info.permission)) return 'member';
  return 'readonly';
}

export function isTeamRole(role) {
  return role === 'leader' || role === 'member';
}

/**
 * 저장소 정보는 gh 활성 계정 기준(권한=그 계정의 권한)이다. 폴더의 사용자(git config github.user)가
 * 활성 계정과 다르면 그 권한을 쓸 수 없으므로, 협업자 목록에 있으면 쓰기 권한으로, 없으면 모름(null)으로 본다.
 */
export function infoForUser(info, who, active) {
  if (!info || !who || !active || who.toLowerCase() === active.toLowerCase()) return info;
  const listed = (info.members || []).some((m) => m.toLowerCase() === who.toLowerCase());
  return { ...info, permission: listed ? 'WRITE' : null };
}
