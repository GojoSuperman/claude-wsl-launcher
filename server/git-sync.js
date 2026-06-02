// server/git-sync.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const TIMEOUT = 15000; // 네트워크 작업 — status 보다 길게

/**
 * git 명령 실행 (네트워크/변경). 결과 {ok, error?}. throw 하지 않음.
 */
async function run(dir, args) {
  try {
    await execFileP('git', ['-C', dir, ...args], { timeout: TIMEOUT, windowsHide: true });
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
