// server/github.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cloneInto, deriveName, CLONE_TIMEOUT } from './cloner.js';

const execFileP = promisify(execFile);
const LIST_TIMEOUT = 20000;

/**
 * `gh repo list --json ...` 출력(JSON 문자열)을 파싱 → updatedAt 내림차순 정렬 +
 * 각 항목에 imported(=existingNames 에 name 존재) 부착. 순수 함수.
 * 깨진/배열 아닌 입력은 빈 배열.
 * @param {string} jsonStr
 * @param {string[]} existingNames
 */
export function parseRepos(jsonStr, existingNames = []) {
  let arr;
  try { arr = JSON.parse(jsonStr); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const have = new Set(existingNames);
  return arr
    .filter((r) => r && typeof r.name === 'string')
    .map((r) => ({
      name: r.name,
      nameWithOwner: typeof r.nameWithOwner === 'string' ? r.nameWithOwner : '',
      visibility: typeof r.visibility === 'string' ? r.visibility : '',
      url: typeof r.url === 'string' ? r.url : '',
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
      imported: have.has(r.name),
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

/** owner/repo 형태 + 인자 악용('-' 시작) 차단. 순수. */
export function isValidNameWithOwner(s) {
  if (typeof s !== 'string' || s.startsWith('-')) return false;
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(s);
}

/** `gh repo list` 실행 → {ok:true, raw} | {ok:false, error}. 절대 throw 안 함. */
export async function listRepos(limit = 200) {
  try {
    const { stdout } = await execFileP('gh',
      ['repo', 'list', '--json', 'name,nameWithOwner,visibility,url,updatedAt', '--limit', String(limit)],
      { timeout: LIST_TIMEOUT, windowsHide: true });
    return { ok: true, raw: stdout };
  } catch (e) {
    const msg = (e.stderr || e.message || 'gh repo list 실패').toString().trim();
    return { ok: false, error: msg };
  }
}

/**
 * nameWithOwner 를 projectsRoot/<name> 으로 clone. 절대 throw 안 함.
 *
 * `gh repo clone` 은 사용자의 gh `git_protocol` 설정(ssh 일 수 있음)을 따르므로 SSH 키가
 * 없으면 실패한다. 이를 피하려고 https URL 을 git 으로 직접 clone 하되, gh 를 1회성
 * credential helper(`gh auth git-credential`)로 주입해 **토큰 https** 인증을 강제한다.
 * (inherited helper 를 빈 값으로 먼저 초기화 → gh helper 만 사용)
 * @returns {Promise<{ok:boolean, error?:string, name?:string, path?:string}>}
 */
export async function cloneRepo(projectsRoot, nameWithOwner, name) {
  if (!isValidNameWithOwner(nameWithOwner)) {
    return { ok: false, error: 'invalid repo' };
  }
  const finalName = (typeof name === 'string' && name.trim()) ? name.trim() : deriveName(nameWithOwner);
  const url = `https://github.com/${nameWithOwner}`;
  return cloneInto(projectsRoot, finalName, (target) =>
    execFileP('git', [
      '-c', 'credential.helper=',
      '-c', 'credential.helper=!gh auth git-credential',
      'clone', '--', url, target,
    ], {
      timeout: CLONE_TIMEOUT,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }));
}

/** gh repo delete stderr → 사용자 친절 메시지(순수). 스코프/권한 오류는 안내로 변환. */
export function mapDeleteError(stderr) {
  const s = (stderr || '').toString();
  if (/delete_repo|HTTP 403|Must have admin|needs? the .*scope/i.test(s)) {
    return 'GitHub 삭제 권한이 없습니다. 터미널에서 `gh auth refresh -s delete_repo` 실행 후 다시 시도하세요.';
  }
  return s.trim() || 'gh repo delete 실패';
}

/** nameWithOwner 레포를 gh 로 영구 삭제. 절대 throw 안 함. */
export async function deleteRepo(nameWithOwner) {
  if (!isValidNameWithOwner(nameWithOwner)) {
    return { ok: false, error: 'invalid repo' };
  }
  try {
    await execFileP('gh', ['repo', 'delete', nameWithOwner, '--yes'],
      { timeout: 20000, windowsHide: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mapDeleteError(e.stderr || e.message) };
  }
}

/** nameWithOwner 레포 이름을 newName 으로 변경(gh 가 origin URL 도 갱신). 절대 throw 안 함. */
export async function renameRepo(nameWithOwner, newName, cwd) {
  if (!isValidNameWithOwner(nameWithOwner)) {
    return { ok: false, error: 'invalid repo' };
  }
  if (typeof newName !== 'string' || !/^[A-Za-z0-9._-]+$/.test(newName)) {
    return { ok: false, error: 'invalid name' };
  }
  try {
    await execFileP('gh', ['repo', 'rename', newName, '-R', nameWithOwner, '--yes'],
      { cwd, timeout: 20000, windowsHide: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e.stderr || e.message || 'gh repo rename 실패').toString().trim() };
  }
}
