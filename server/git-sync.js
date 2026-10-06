// server/git-sync.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const TIMEOUT = 15000; // 네트워크 작업 — status 보다 길게

// SSH 키가 없는 환경에서도 원격 작업이 되도록: gh 에 로그인돼 있으면 github SSH URL 을 전송 시점에
// https 로 재작성(insteadOf)하고 gh 를 1회성 credential helper 로 넣어 토큰 https 인증을 쓴다.
// gh 로그인이 없으면 손대지 않는다 — SSH 키·자체 자격증명 관리자로 잘 쓰던 사용자를 막지 않게.
// (github 외 remote 는 재작성 대상이 아니라 영향 없음)
const GH_HTTPS = [
  '-c', 'url.https://github.com/.insteadOf=git@github.com:',
  '-c', 'url.https://github.com/.insteadOf=ssh://git@github.com/',
  '-c', 'credential.helper=',
  '-c', 'credential.helper=!gh auth git-credential',
];

/** git 인자 배열 (순수). ghReady 면 GH_HTTPS 를 끼운다. */
export function buildGitArgs(dir, args, ghReady) {
  return ['-C', dir, ...(ghReady ? GH_HTTPS : []), ...args];
}

// gh 로그인 여부 — 원격 작업마다 gh 를 부르지 않게 1분 기억
const GH_CHECK_MS = 60000;
let ghCache = { at: 0, ok: false };
async function ghReady() {
  if (Date.now() - ghCache.at < GH_CHECK_MS) return ghCache.ok;
  let ok = false;
  try {
    await execFileP('gh', ['auth', 'status'], { timeout: 5000, windowsHide: true });
    ok = true;
  } catch { /* gh 없음·미로그인 */ }
  ghCache = { at: Date.now(), ok };
  return ok;
}

/**
 * git 명령 실행 (네트워크/변경). 결과 {ok, error?}. throw 하지 않음.
 */
async function run(dir, args) {
  try {
    await execFileP('git', buildGitArgs(dir, args, await ghReady()), {
      timeout: TIMEOUT,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // 인증 실패 시 hang 대신 즉시 실패
    });
    return { ok: true };
  } catch (e) {
    const msg = (e.stderr || e.message || 'git 명령 실패').toString().trim();
    return { ok: false, error: msg };
  }
}

/** 원격에서 fetch (네트워크 읽기). {ok, error?} */
export function fetch(dir) {
  return run(dir, ['fetch', '--quiet']);
}

/** ff-only pull (네트워크 + 작업트리 변경). ff 불가/충돌이면 ok:false. {ok, error?} */
export function pull(dir) {
  return run(dir, ['pull', '--ff-only', '--quiet']);
}
