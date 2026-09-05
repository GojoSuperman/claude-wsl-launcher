// server/folders.js
// 폴더 선택창용 읽기 전용 조회: 하위 폴더 목록 + "프로젝트 폴더" 후보(홈 아래에서 git 저장소를 품은 폴더).
// 절대 throw 안 함. 숨김 폴더·node_modules 제외.
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules']);

function subdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith('.') && !SKIP.has(e.name))
      .filter((e) => { try { return fs.statSync(path.join(dir, e.name)).isDirectory(); } catch { return false; } })
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return null;
  }
}
const isRepo = (dir) => { try { return fs.statSync(path.join(dir, '.git')).isDirectory(); } catch { return false; } };
const repoCount = (dir) => (subdirs(dir) || []).filter((n) => isRepo(path.join(dir, n))).length;

/**
 * 한 폴더의 하위 폴더 목록. 각 항목에 git 저장소 여부와 "품은 저장소 수".
 * @returns {{ok:true, path:string, parent:string|null, entries:{name:string,path:string,isRepo:boolean,repos:number}[]} | {ok:false, error:string}}
 */
export function listDir(absPath) {
  if (typeof absPath !== 'string' || !path.isAbsolute(absPath)) return { ok: false, error: 'not absolute' };
  const full = path.normalize(absPath);
  try {
    if (!fs.statSync(full).isDirectory()) return { ok: false, error: 'not a directory' };
  } catch {
    return { ok: false, error: 'not found' };
  }
  const names = subdirs(full);
  if (names === null) return { ok: false, error: 'unreadable' };
  const parent = path.dirname(full) === full ? null : path.dirname(full);
  return {
    ok: true,
    path: full,
    parent,
    entries: names.map((name) => {
      const p = path.join(full, name);
      return { name, path: p, isRepo: isRepo(p), repos: repoCount(p) };
    }),
  };
}

/**
 * 홈 아래 depth 단계까지 "직속 자식 중 git 저장소가 1개 이상인 폴더"를 저장소 수 내림차순으로.
 * (scripts/lib/find-projects-root.sh 와 같은 규칙) 자기 자신이 저장소인 폴더는 제외.
 * @returns {{path:string, repos:number}[]}
 */
export function candidates(home, { depth = 2, limit = 8 } = {}) {
  const out = [];
  const walk = (dir, level) => {
    if (level > depth) return;
    for (const name of subdirs(dir) || []) {
      const p = path.join(dir, name);
      if (isRepo(p)) continue;
      const n = repoCount(p);
      if (n > 0) out.push({ path: p, repos: n });
      walk(p, level + 1);
    }
  };
  if (typeof home === 'string' && path.isAbsolute(home)) walk(home, 1);
  return out.sort((a, b) => b.repos - a.repos || a.path.localeCompare(b.path)).slice(0, limit);
}
