// server/cloner.js
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isValidName } from './paths.js';

const execFileP = promisify(execFile);
export const CLONE_TIMEOUT = 120000; // clone 은 길게 (큰 repo 대비)

// url 끝에서 repo 이름 추출: .../repo.git → repo, git@host:u/repo.git → repo, owner/repo → repo
export function deriveName(url) {
  const tail = String(url).replace(/[/]+$/, '').split(/[/:]/).pop() || '';
  return tail.replace(/\.git$/i, '');
}

function isValidUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (url.startsWith('-')) return false;            // 인자 악용 차단
  return /^https:\/\/\S+$/.test(url)
    || /^ssh:\/\/\S+$/.test(url)
    || /^file:\/\/\S+$/.test(url)
    || /^git@[^\s:]+:\S+$/.test(url);
}

/**
 * projectsRoot/<name> 으로 clone 하는 공통 골격: root/name 검증 → 중복 체크 →
 * runFn(target) 실행 → 실패 시 반쪽 폴더 정리. 절대 throw 안 함.
 * @param {string} projectsRoot 절대경로
 * @param {string} name 프로젝트(폴더) 이름
 * @param {(target:string)=>Promise<any>} runFn target 으로 실제 clone 수행
 * @returns {Promise<{ok:boolean, error?:string, name?:string, path?:string}>}
 */
export async function cloneInto(projectsRoot, name, runFn) {
  if (typeof projectsRoot !== 'string' || !path.isAbsolute(projectsRoot)) {
    return { ok: false, error: 'invalid root' };
  }
  if (!isValidName(name)) {
    return { ok: false, error: 'invalid name' };
  }
  const target = path.join(projectsRoot, name);
  if (fs.existsSync(target)) {
    return { ok: false, error: 'already exists' };
  }
  try {
    await runFn(target);
  } catch (e) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch { /* 반쪽 폴더 정리 */ }
    const msg = (e.stderr || e.message || 'clone 실패').toString().trim();
    return { ok: false, error: msg };
  }
  return { ok: true, name, path: target };
}

/**
 * url 을 projectsRoot/<name> 으로 git clone. name 없으면 url 에서 추출. 절대 throw 안 함.
 * @returns {Promise<{ok:boolean, error?:string, name?:string, path?:string}>}
 */
export async function clone(projectsRoot, url, name) {
  if (!isValidUrl(url)) {
    return { ok: false, error: 'invalid url' };
  }
  const finalName = (typeof name === 'string' && name.trim()) ? name.trim() : deriveName(url);
  return cloneInto(projectsRoot, finalName, (target) =>
    execFileP('git', ['clone', '--', url, target], {
      timeout: CLONE_TIMEOUT,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // 인증 hang 방지(즉시 실패)
    }));
}
