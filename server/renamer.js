// server/renamer.js
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isValidName, isGithubSafeName, resolveProject } from './paths.js';
import { encode } from './session.js';
import { originRepo } from './git.js';
import { renameNote } from './notes.js';
import { renameRepo as ghRenameRepo } from './github.js';

/**
 * 프로젝트 폴더 이름 변경 (mutating). 절대 throw 안 함.
 * 1) 로컬 폴더 이동  2) claude 세션 이력 폴더 이동  3) 메모 키 이동
 * 4) origin 이 GitHub 면 gh repo rename (remote URL 은 gh 가 갱신)
 * GitHub 단계 실패는 warning 으로만 보고하고 로컬 변경은 유지한다 (GitHub 는 옛 이름을 redirect 함).
 * @returns {Promise<{ok:boolean, error?:string, path?:string, github?:string|null, warning?:string}>}
 */
export async function rename({
  projectsRoot, home, name, newName, notesFile,
  renameRepo = ghRenameRepo, isRunning = () => false, isSelf = () => false,
}) {
  const full = resolveProject(projectsRoot, name);
  if (!full) return { ok: false, error: 'unknown project' };
  if (!isValidName(newName)) return { ok: false, error: 'invalid name' };
  if (!isGithubSafeName(newName)) return { ok: false, error: 'ascii only' };
  const target = path.join(projectsRoot, newName);
  if (fs.existsSync(target)) return { ok: false, error: 'already exists' };
  if (isRunning(full)) return { ok: false, error: 'running' };
  if (isSelf(full)) return { ok: false, error: 'self' };

  const repo = await originRepo(full); // 'owner/repo' | null — 이동 전에 읽어둔다

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

  if (notesFile) {
    const n = renameNote(notesFile, name, newName);
    if (!n.ok) console.warn(`[renamer] 메모 이동 실패 (${name}):`, n.error);
  }

  if (!repo) return { ok: true, path: target, github: null };

  const r = await renameRepo(repo, newName, target);
  if (!r.ok) {
    console.warn(`[renamer] gh repo rename 실패 (${repo}):`, r.error);
    return { ok: true, path: target, github: null, warning: r.error };
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
