// public/card-status.js
// 카드의 git/동기화 상태 → 표현 descriptor (순수 함수, DOM/네트워크 무의존 → node:test).
// 입력: { isGit, hasUpstream, checked, sync, role }
//   sync: {ahead,behind,state, branch?,defaultBranch?,mainBehind?,pr?,openPrs?} | {failed:true} | undefined
//   role: team-role.js 의 역할 (leader/member 면 팀 프로젝트 → team-status.js 결과 사용)
// 출력: { level, stripKey, stripArg?, locked, showCheck, showPull, githubKey, githubArgs, hintKey, hintArg?, team }
//   level: 'action'(빨강) | 'ok'(초록) | 'warn'(노랑) | 'info'(파랑) | 'muted'(회색) | 'none'(띠 없음)
import { isTeamRole } from './team-role.js';
import { computeTeamStatus } from './team-status.js';

export function computeCardStatus({ isGit, hasUpstream, checked, sync, role, branch }) {
  const team = isTeamRole(role);
  const out = (o) => ({ hintKey: null, ...o, team });
  if (!isGit) {
    return out({ level: 'none', stripKey: null, locked: false, showCheck: false, showPull: false, githubKey: null, githubArgs: [] });
  }
  if (!hasUpstream && (!team || !checked)) {
    // 팀 프로젝트는 브랜치를 아직 안 올렸어도 main 기준 확인이 필요 → 확인 버튼(잠금 없음)
    // (팀이면 '바로 작업 가능' 대신 확인을 권함 — 아직 main·PR 상태를 모름)
    return out({ level: 'muted', stripKey: team ? 'stripTeamCheck' : 'stripNoUpstream', locked: false, showCheck: team, showPull: false, githubKey: 'ghNoUpstream', githubArgs: [] });
  }
  if (!checked) {
    return out({ level: 'action', stripKey: 'stripCheck', locked: true, showCheck: true, showPull: false, githubKey: 'ghNotChecked', githubArgs: [] });
  }
  if (sync && sync.failed) {
    return out({ level: 'muted', stripKey: 'stripFailed', locked: false, showCheck: true, showPull: false, githubKey: 'ghCheckFailed', githubArgs: [] });
  }
  const ahead = sync ? sync.ahead : 0;
  const behind = sync ? sync.behind : 0;
  const state = sync ? sync.state : 'synced';

  if (team) {
    // 확인한 뒤 브랜치가 바뀌었거나(claude 가 새 브랜치를 만듦 등), 받기 직후라 팀 정보가 없는 확인 결과면
    // 옛 기준의 띠·할 말은 틀린 안내가 된다 → 다시 확인을 권한다(잠그지는 않음)
    if (!sync || sync.branch === undefined || (branch && sync.branch && branch !== sync.branch)) {
      return out({ level: 'muted', stripKey: 'stripTeamCheck', locked: false, showCheck: true, showPull: state === 'behind',
        githubKey: hasUpstream ? 'ghNotChecked' : 'ghNoUpstream', githubArgs: [] });
    }
    const ts = computeTeamStatus({
      role, branch: sync?.branch, defaultBranch: sync?.defaultBranch, hasUpstream,
      upBehind: behind, mainBehind: sync?.mainBehind ?? 0, pr: sync?.pr ?? null, openPrs: sync?.openPrs ?? null,
    });
    if (ts) {
      const onWork = sync?.defaultBranch && sync.branch !== sync.defaultBranch;
      let gh = ['upToDate', []];
      if (!hasUpstream) gh = ['ghNoUpstream', []];
      else if (onWork && sync.mainBehind > 0) gh = ['ghMainBehind', [sync.mainBehind]];
      else if (state === 'ahead') gh = ['ahead', [ahead]];
      return out({ level: ts.level, stripKey: ts.stripKey, stripArg: ts.stripArg, locked: false, showCheck: true, showPull: false,
        githubKey: gh[0], githubArgs: gh[1], hintKey: ts.hintKey, hintArg: ts.hintArg });
    }
    // 팀 띠가 없고 브랜치도 안 올렸으면(기본 브랜치를 몰라 판단 불가 등) 초록 '같아요' 대신 기존 추적 없음
    if (!hasUpstream) {
      return out({ level: 'muted', stripKey: 'stripNoUpstream', locked: false, showCheck: true, showPull: false, githubKey: 'ghNoUpstream', githubArgs: [] });
    }
  }

  if (state === 'behind') {
    return out({ level: 'action', stripKey: 'stripBehind', stripArg: behind, locked: false, showCheck: true, showPull: true, githubKey: 'behind', githubArgs: [behind] });
  }
  if (state === 'ahead') {
    return out({ level: 'warn', stripKey: 'stripAhead', stripArg: ahead, locked: false, showCheck: true, showPull: false, githubKey: 'ahead', githubArgs: [ahead] });
  }
  if (state === 'diverged') {
    return out({ level: 'action', stripKey: 'stripDiverged', locked: false, showCheck: true, showPull: false, githubKey: 'diverged', githubArgs: [ahead, behind] });
  }
  return out({ level: 'ok', stripKey: 'stripSynced', locked: false, showCheck: true, showPull: false, githubKey: 'upToDate', githubArgs: [] });
}
