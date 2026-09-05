// server/renamer.js
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isValidName, resolveProject } from './paths.js';
import { encode } from './session.js';

const execFileP = promisify(execFile);
const GH_TIMEOUT = 20000; // 네트워크

/** remote URL 에서 GitHub owner/repo 추출. GitHub 가 아니면 null. */
export function parseGithubRepo(url) {
  if (typeof url !== 'string') return null;
  const m = url.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** gh CLI 실행 → {ok, error?}. throw 하지 않음. */
async function defaultRunGh(args, cwd) {
  try {
    await execFileP('gh', args, { cwd, timeout: GH_TIMEOUT, windowsHide: true });
    return { ok: true };
  } catch (e) {
    const msg = (e.stderr || e.message || 'gh 실패').toString().trim();
    return { ok: false, error: msg };
  }
}

async function originUrl(dir) {
  try {
    const { stdout } = await execFileP('git', ['-C', dir, 'remote', 'get-url', 'origin'], { timeout: 3000, windowsHide: true });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * 프로젝트 폴더 이름 변경 (mutating). 절대 throw 안 함.
 * 1) 로컬 폴더 이동  2) claude 세션 이력 폴더 이동  3) origin 이 GitHub 면 gh repo rename (remote URL 은 gh 가 갱신)
 * GitHub 단계 실패는 warning 으로만 보고하고 로컬 변경은 유지한다 (GitHub 는 옛 이름을 redirect 함).
 * @returns {Promise<{ok:boolean, error?:string, path?:string, github?:string|null, warning?:string}>}
 */
export async function rename({ projectsRoot, home, name, newName, runGh = defaultRunGh, isRunning = () => false }) {
  const full = resolveProject(projectsRoot, name);
  if (!full) return { ok: false, error: 'unknown project' };
  if (!isValidName(newName)) return { ok: false, error: 'invalid name' };
  const target = path.join(projectsRoot, newName);
  if (fs.existsSync(target)) return { ok: false, error: 'already exists' };
  if (isRunning(full)) return { ok: false, error: 'project is running' };

  // GitHub 정보는 이동 전에 읽어둔다 (이동 후에도 .git 은 같이 가지만 순서를 명확히)
  const repo = parseGithubRepo(await originUrl(full));

  try {
    fs.renameSync(full, target);
  } catch (e) {
    return { ok: false, error: e.message || 'rename 실패' };
  }

  // claude 세션 이력 폴더 이동 — 실패해도 비치명적
  const oldSess = path.join(home, '.claude', 'projects', encode(full));
  const newSess = path.join(home, '.claude', 'projects', encode(target));
  if (fs.existsSync(oldSess) && !fs.existsSync(newSess)) {
    try {
      fs.renameSync(oldSess, newSess);
    } catch (e) {
      console.warn(`[renamer] 세션 폴더 이동 실패 (${name}):`, e.message);
    }
  }

  if (!repo) return { ok: true, path: target, github: null };

  const r = await runGh(['repo', 'rename', newName, '-R', repo, '--yes'], target);
  if (!r.ok) {
    console.warn(`[renamer] gh repo rename 실패 (${repo}):`, r.error);
    return { ok: true, path: target, github: null, warning: `GitHub rename failed: ${r.error}` };
  }
  // gh 는 -R 로 지정하면 로컬 remote 를 안 바꾸므로 직접 갱신 (실패해도 redirect 로 동작하니 비치명적)
  const owner = repo.split('/')[0];
  try {
    execFileSync('git', ['-C', target, 'remote', 'set-url', 'origin', `https://github.com/${owner}/${newName}.git`],
      { stdio: 'ignore', timeout: 3000 });
  } catch (e) {
    console.warn(`[renamer] remote URL 갱신 실패 (${newName}):`, e.message);
  }
  return { ok: true, path: target, github: `${owner}/${newName}` };
}
