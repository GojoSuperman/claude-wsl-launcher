// server/git.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const TIMEOUT = 3000;

/** git 명령 실행 → trim된 stdout. 실패 시 null (throw 안 함). */
async function git(dir, args) {
  try {
    const { stdout } = await execFileP('git', ['-C', dir, ...args], {
      timeout: TIMEOUT,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

// 도구가 스스로 만드는 폴더 — 이것만 미추적이면 "미커밋 변경"으로 치지 않는다 (bkit 플러그인, 설계 미리보기)
export const TOOL_DIRS = ['.bkit/', '.superpowers/'];

/** git status --porcelain 출력 → 사용자가 바꾼 것이 있는가 (순수) */
export function isDirty(porcelain) {
  return porcelain.split('\n').filter(Boolean)
    .some((l) => !(l.startsWith('?? ') && TOOL_DIRS.includes(l.slice(3))));
}

/**
 * 한 디렉토리의 git 상태 (read-only). 절대 throw 하지 않는다.
 * @returns {Promise<{isGit:boolean, branch:string|null, dirty:boolean|null, lastCommitISO:string|null, hasUpstream:boolean}>}
 */
export async function status(dir) {
  const none = { isGit: false, branch: null, dirty: null, lastCommitISO: null, hasUpstream: false };

  const inside = await git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') return none;

  let branch = await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const lastCommit = await git(dir, ['log', '-1', '--format=%cI']);
  // 커밋 0개면 rev-parse 가 HEAD 를 돌려준다 → 실제로 만들어질 브랜치 이름(예: main)
  if (!lastCommit) branch = (await git(dir, ['symbolic-ref', '--short', 'HEAD'])) || branch;
  const porcelain = await git(dir, ['status', '--porcelain']);
  const upstream = await git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);

  return {
    isGit: true,
    branch: branch || null,
    dirty: porcelain === null ? null : isDirty(porcelain),
    lastCommitISO: lastCommit || null,
    hasUpstream: upstream !== null,
  };
}

/**
 * 로컬 refs 기준 ahead/behind (read-only, 네트워크 없음). 업스트림 없거나 실패 → {0,0}.
 * fetch 직후 호출해야 원격 최신과 비교됨.
 * @returns {Promise<{ahead:number, behind:number}>}
 */
export async function aheadBehind(dir) {
  const out = await git(dir, ['rev-list', '--left-right', '--count', '@{u}...HEAD']);
  if (!out) return { ahead: 0, behind: 0 };
  // 출력: "<behind>\t<ahead>"  (@{u}...HEAD → 왼쪽=업스트림 고유=behind, 오른쪽=HEAD 고유=ahead)
  const parts = out.split(/\s+/);
  const behind = Number(parts[0]);
  const ahead = Number(parts[1]);
  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

/**
 * origin URL 문자열에서 'owner/repo' 추출 (순수). github.com 이 아니면 null.
 * ssh(git@github.com:o/r.git) / https(https://github.com/o/r(.git)) 모두 지원.
 */
export function parseOriginRepo(url) {
  if (typeof url !== 'string') return null;
  const s = url.trim();
  if (!s) return null;
  const m = s.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * 이 폴더의 GitHub 사용자(git config github.user). 한 PC 에 GitHub 계정이 여럿일 때
 * 폴더별로 "나"를 정하려고 쓴다(없으면 null → gh 활성 계정 사용).
 */
export async function localGithubUser(dir) {
  // --local: github.user 는 hub·forge 등 다른 도구가 전역에 두는 흔한 키 → 이 폴더에 직접 넣은 값만 쓴다
  return (await git(dir, ['config', '--local', '--get', 'github.user'])) || null;
}

/** origin 의 기본 브랜치 이름(refs/remotes/origin/HEAD). 없으면 null. */
export async function defaultBranch(dir) {
  const ref = await git(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  return ref && ref.startsWith('origin/') ? ref.slice('origin/'.length) : null;
}

/** 지금 HEAD vs ref(예: origin/main) 앞섬·뒤짐. ref 가 없으면 null. fetch 직후에 부를 것. */
export async function aheadBehindRef(dir, ref) {
  if (!(await git(dir, ['rev-parse', '--verify', '--quiet', ref]))) return null;
  const out = await git(dir, ['rev-list', '--left-right', '--count', `${ref}...HEAD`]);
  if (!out) return null;
  const [behind, ahead] = out.split(/\s+/).map(Number);
  return { ahead: Number.isFinite(ahead) ? ahead : 0, behind: Number.isFinite(behind) ? behind : 0 };
}

/** origin 원격이 github 면 'owner/repo', 아니면 null. 절대 throw 안 함. */
export async function originRepo(dir) {
  const url = await git(dir, ['remote', 'get-url', 'origin']);
  return parseOriginRepo(url);
}
