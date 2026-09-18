// server/updater.js
// 대시보드 헤더 [업데이트] — 이 도구 자신을 최신으로 갱신한다.
//
// 왜 필요한가: 지금까지 업데이트는 WSL 터미널에서 git pull + npm install 을 직접 치는
// 길뿐이었다. 터미널을 안 쓰는 사용자에게는 사실상 불가능하고, 더 나쁜 건 pull 만 하고
// 서버를 안 껐을 때다 — 화면은 새 코드, 서버는 옛 코드라 새 기능이 '서버 오류'로 보인다.
// 업데이트와 재시작 안내를 한 동작으로 묶어 그 함정 자체를 없앤다.
//
// 안전 원칙: 실패하면 아무것도 건드리지 않는다. pull 은 --ff-only 라서 로컬 변경이나
// 갈라진 이력이 있으면 그냥 거부되고(작업트리 보존) 원인을 코드로 돌려준다.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fetch as gitFetch, pull as gitPull } from './git-sync.js';
import { aheadBehind } from './git.js';

const execFileP = promisify(execFile);
const NPM_TIMEOUT = 180000; // npm install 은 느릴 수 있다 (네트워크 + 빌드)

/**
 * git pull 실패 원인을 화면에 번역해 보여줄 코드로 분류. 순수 함수.
 * 모르면 null → UI 는 원문을 그대로 보여준다.
 * @returns {'local-changes'|'diverged'|'network'|null}
 */
export function classifyPullError(stderr) {
  const s = (stderr || '').toString();
  if (!s.trim()) return null;
  if (/local changes|would be overwritten|Please commit your changes|stash/i.test(s)) return 'local-changes';
  if (/fast-forward|divergent|diverged/i.test(s)) return 'diverged';
  if (/Could not resolve host|unable to access|Network is unreachable|Connection timed out|no such host/i.test(s)) return 'network';
  return null;
}

/** aheadBehind 결과로 '받을 게 있나' 판정. 순수 함수. */
export function needsUpdate(ab) {
  return Number(ab?.behind) > 0;
}

/**
 * 원격에 새 버전이 있는지 확인 (fetch 후 behind 계산). 절대 throw 안 함.
 * @returns {Promise<{ok:boolean, behind?:number, error?:string, code?:string}>}
 */
export async function check(dir) {
  const f = await gitFetch(dir);
  if (!f.ok) return { ok: false, error: f.error, code: classifyPullError(f.error) };
  const ab = await aheadBehind(dir);
  return { ok: true, behind: ab.behind, available: needsUpdate(ab) };
}

/**
 * 실제 업데이트: fetch → pull --ff-only → npm install. 절대 throw 안 함.
 * 어느 단계에서 실패했는지 step 으로 알려준다(UI 가 무엇을 안내할지 정하는 데 씀).
 * @returns {Promise<{ok:boolean, step?:string, error?:string, code?:string, changed?:boolean}>}
 */
export async function update(dir) {
  const f = await gitFetch(dir);
  if (!f.ok) return { ok: false, step: 'fetch', error: f.error, code: classifyPullError(f.error) };

  const before = await aheadBehind(dir);
  if (!needsUpdate(before)) {
    // 받을 게 없으면 npm install 도 건너뛴다 — 괜히 오래 걸릴 이유가 없다
    return { ok: true, changed: false };
  }

  const p = await gitPull(dir);
  if (!p.ok) return { ok: false, step: 'pull', error: p.error, code: classifyPullError(p.error) };

  try {
    await execFileP('npm', ['install', '--prefix', dir], { timeout: NPM_TIMEOUT, windowsHide: true });
  } catch (e) {
    // 코드는 이미 새것이므로 되돌리지 않는다. 의존성만 미설치 상태 —
    // 재시작 전에 사용자가 알아야 하므로 실패로 보고한다.
    const msg = (e.stderr || e.message || 'npm install 실패').toString().trim();
    return { ok: false, step: 'npm', error: msg };
  }
  return { ok: true, changed: true };
}
