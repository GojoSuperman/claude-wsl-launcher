// server/creator.js
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isValidName, isGithubSafeName } from './paths.js';

/**
 * projectsRoot 아래에 name 폴더를 만들고 git init 한다 (mutating). 절대 throw 안 함.
 * @returns {{ok:boolean, error?:string, path?:string}}
 */
export function create(projectsRoot, name) {
  if (typeof projectsRoot !== 'string' || !path.isAbsolute(projectsRoot)) {
    return { ok: false, error: 'invalid root' };
  }
  if (!isValidName(name)) {
    return { ok: false, error: 'invalid name' };
  }
  if (!isGithubSafeName(name)) {
    return { ok: false, error: 'ascii only' }; // 한글 등: GitHub 규칙 + claude 세션 폴더 충돌 방지
  }
  const full = path.join(projectsRoot, name);
  if (fs.existsSync(full)) {
    return { ok: false, error: 'already exists' };
  }
  try {
    fs.mkdirSync(full); // EEXIST(경쟁) 등은 catch 로
  } catch (e) {
    const msg = e.code === 'EEXIST' ? 'already exists' : (e.message || 'mkdir 실패');
    return { ok: false, error: msg };
  }
  // git init 은 부가 — 실패해도 폴더 생성은 성공으로 둔다
  try {
    execFileSync('git', ['-C', full, 'init', '-q'], { stdio: 'ignore', timeout: 5000 });
  } catch (e) {
    console.warn(`[creator] git init 실패 (${name}):`, e.message);
  }
  return { ok: true, path: full };
}
