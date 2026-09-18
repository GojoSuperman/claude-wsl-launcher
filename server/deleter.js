// server/deleter.js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveProject } from './paths.js';

const execFileP = promisify(execFile);
const TIMEOUT = 10000;

/** 기본 runner: gio trash 로 휴지통 이동(WSL ~/.local/share/Trash). */
async function defaultRunner(full) {
  await execFileP('gio', ['trash', '--', full], { timeout: TIMEOUT, windowsHide: true });
}

/**
 * projectsRoot/<name> 폴더를 휴지통으로 이동(복구 가능). 절대 throw 안 함.
 * resolveProject 로 검증(존재·root 직속·경로탈출 차단). runner 주입으로 테스트 가능.
 * @returns {Promise<{ok:boolean, error?:string, method?:string}>}
 */
export async function trashLocal(projectsRoot, name, runner = defaultRunner) {
  const full = resolveProject(projectsRoot, name);
  if (!full) return { ok: false, error: 'unknown project' };
  try {
    await runner(full);
    return { ok: true, method: 'gio-trash' };
  } catch (e) {
    const msg = (e.stderr || e.message || 'gio trash 실패').toString().trim();
    return { ok: false, error: msg };
  }
}
