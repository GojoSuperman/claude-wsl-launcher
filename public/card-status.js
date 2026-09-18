// public/card-status.js
// 카드의 git/동기화 상태 → 표현 descriptor (순수 함수, DOM/네트워크 무의존 → node:test).
// 입력: { isGit, hasUpstream, checked, sync }
//   sync: {ahead,behind,state} | {failed:true} | undefined
// 출력: { level, stripKey, stripArg?, locked, showCheck, showPull, githubKey, githubArgs }
//   level: 'action'(빨강) | 'ok'(초록) | 'warn'(노랑) | 'muted'(회색) | 'none'(띠 없음)
export function computeCardStatus({ isGit, hasUpstream, checked, sync }) {
  if (!isGit) {
    return { level: 'none', stripKey: null, locked: false, showCheck: false, showPull: false, githubKey: null, githubArgs: [] };
  }
  if (!hasUpstream) {
    return { level: 'muted', stripKey: 'stripNoUpstream', locked: false, showCheck: false, showPull: false, githubKey: 'ghNoUpstream', githubArgs: [] };
  }
  // 이하 upstream 있는 repo → 확인 버튼 항상 노출(재확인 가능)
  if (!checked) {
    return { level: 'action', stripKey: 'stripCheck', locked: true, showCheck: true, showPull: false, githubKey: 'ghNotChecked', githubArgs: [] };
  }
  if (sync && sync.failed) {
    return { level: 'muted', stripKey: 'stripFailed', locked: false, showCheck: true, showPull: false, githubKey: 'ghCheckFailed', githubArgs: [] };
  }
  const ahead = sync ? sync.ahead : 0;
  const behind = sync ? sync.behind : 0;
  const state = sync ? sync.state : 'synced';
  if (state === 'behind') {
    return { level: 'action', stripKey: 'stripBehind', stripArg: behind, locked: false, showCheck: true, showPull: true, githubKey: 'behind', githubArgs: [behind] };
  }
  if (state === 'ahead') {
    return { level: 'warn', stripKey: 'stripAhead', stripArg: ahead, locked: false, showCheck: true, showPull: false, githubKey: 'ahead', githubArgs: [ahead] };
  }
  if (state === 'diverged') {
    return { level: 'action', stripKey: 'stripDiverged', locked: false, showCheck: true, showPull: false, githubKey: 'diverged', githubArgs: [ahead, behind] };
  }
  return { level: 'ok', stripKey: 'stripSynced', locked: false, showCheck: true, showPull: false, githubKey: 'upToDate', githubArgs: [] };
}
