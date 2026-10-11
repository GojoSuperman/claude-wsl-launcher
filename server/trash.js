// server/trash.js
// 런처 휴지통: 카드 삭제(gio trash)로 WSL 휴지통(~/.local/share/Trash)에 간 프로젝트를 보여 주고 되살리거나 영구 삭제한다.
// 작업 폴더 바로 아래에서 지운 것만 다룬다. 절대 throw 안 함. trashDir 주입으로 테스트 가능.
//   (gio trash --restore 는 WSL 에 gvfs 가 없어 'Operation not supported' → 직접 옮긴다)
import fs from 'node:fs';
import path from 'node:path';
import { isValidName } from './paths.js';

/** 기본 휴지통 위치: $XDG_DATA_HOME/Trash (기본 ~/.local/share/Trash) */
export function defaultTrashDir(processEnv, home) {
  return path.join(processEnv.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'Trash');
}

// info/<id>.trashinfo 읽기 → { path(원래 경로), deletedAt } | null
function readInfo(trashDir, id) {
  try {
    const txt = fs.readFileSync(path.join(trashDir, 'info', `${id}.trashinfo`), 'utf8');
    const p = /^Path=(.*)$/m.exec(txt)?.[1];
    if (!p) return null;
    return { path: decodeURIComponent(p.trim()), deletedAt: (/^DeletionDate=(.*)$/m.exec(txt)?.[1] || '').trim() };
  } catch {
    return null;
  }
}

// 작업 폴더 직속에서 지운 항목인지 + 실물이 휴지통에 있는지 → 원래 이름 | null
function projectEntry(trashDir, projectsRoot, id) {
  if (typeof id !== 'string' || !id || id.includes('/') || id === '.' || id === '..') return null;
  const info = readInfo(trashDir, id);
  if (!info || path.dirname(path.resolve(info.path)) !== path.resolve(projectsRoot)) return null;
  try { if (!fs.statSync(path.join(trashDir, 'files', id)).isDirectory()) return null; } catch { return null; }
  return { name: path.basename(info.path), deletedAt: info.deletedAt };
}

/**
 * 휴지통의 프로젝트 목록(최근 삭제 먼저). taken = 같은 이름의 폴더가 지금 작업 폴더에 있음(그대로는 못 되살림).
 * @returns {{id:string, name:string, deletedAt:string, taken:boolean}[]}
 */
export function listTrash({ trashDir, projectsRoot }) {
  let ids;
  try { ids = fs.readdirSync(path.join(trashDir, 'info')).filter((f) => f.endsWith('.trashinfo')).map((f) => f.slice(0, -'.trashinfo'.length)); } catch { return []; }
  const out = [];
  for (const id of ids) {
    const e = projectEntry(trashDir, projectsRoot, id);
    if (e) out.push({ id, ...e, taken: fs.existsSync(path.join(projectsRoot, e.name)) });
  }
  return out.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.name.localeCompare(b.name));
}

/**
 * 휴지통 항목을 작업 폴더로 되살린다(name 을 주면 그 이름으로). 휴지통 기록(.trashinfo)도 지운다.
 * @returns {{ok:true, name:string} | {ok:false, error:'not found'|'invalid name'|'already exists'|string}}
 */
export function restoreTrash({ trashDir, projectsRoot, id, name }) {
  const e = projectEntry(trashDir, projectsRoot, id);
  if (!e) return { ok: false, error: 'not found' };
  const finalName = name ?? e.name;
  if (!isValidName(finalName) || finalName.startsWith('.')) return { ok: false, error: 'invalid name' }; // 숨김 폴더는 카드로 안 보임
  const dest = path.join(projectsRoot, finalName);
  if (fs.existsSync(dest)) return { ok: false, error: 'already exists' };
  try {
    fs.renameSync(path.join(trashDir, 'files', id), dest);
  } catch (err) {
    return { ok: false, error: err.code === 'EXDEV' ? 'cross-device' : err.message };
  }
  try { fs.rmSync(path.join(trashDir, 'info', `${id}.trashinfo`), { force: true }); } catch { /* 기록만 남을 뿐 */ }
  return { ok: true, name: finalName };
}

/**
 * 휴지통 항목 영구 삭제(되돌릴 수 없음). 작업 폴더에서 지운 항목만.
 * @returns {{ok:true} | {ok:false, error:'not found'|string}}
 */
export function purgeTrash({ trashDir, projectsRoot, id }) {
  if (!projectEntry(trashDir, projectsRoot, id)) return { ok: false, error: 'not found' };
  try {
    fs.rmSync(path.join(trashDir, 'files', id), { recursive: true, force: true });
    fs.rmSync(path.join(trashDir, 'info', `${id}.trashinfo`), { force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
