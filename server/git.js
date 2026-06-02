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

/**
 * 한 디렉토리의 git 상태 (read-only). 절대 throw 하지 않는다.
 * @returns {Promise<{isGit:boolean, branch:string|null, dirty:boolean|null, lastCommitISO:string|null, hasUpstream:boolean}>}
 */
export async function status(dir) {
  const none = { isGit: false, branch: null, dirty: null, lastCommitISO: null, hasUpstream: false };

  const inside = await git(dir, ['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') return none;

  const branch = await git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const porcelain = await git(dir, ['status', '--porcelain']);
  const lastCommit = await git(dir, ['log', '-1', '--format=%cI']);
  const upstream = await git(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);

  return {
    isGit: true,
    branch: branch || null,
    dirty: porcelain === null ? null : porcelain.length > 0,
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
