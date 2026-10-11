// server/folders.js
// 가져오기 창용 읽기 전용 조회: 하위 폴더 목록 + Windows 바로가기(바탕 화면·문서·다운로드·드라이브).
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

const WIN_SYSTEM_USERS = new Set(['all users', 'default', 'default user', 'public']);

/**
 * Windows 사용자 폴더(/mnt/c/Users/<이름>) 목록 — 가져오기 창의 후보. 시스템 계정·defaultuser* 는 제외.
 * @returns {string[]}
 */
export function windowsHomes(base = '/mnt/c/Users') {
  try {
    return fs.readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !WIN_SYSTEM_USERS.has(e.name.toLowerCase()) && !/^defaultuser/i.test(e.name))
      .map((e) => path.join(base, e.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const oneDrives = (u) => { try { return fs.readdirSync(u).filter((n) => /^OneDrive/i.test(n)).sort().map((n) => path.join(u, n)); } catch { return []; } };
// 알려진 폴더 위치 후보(앞이 우선). OneDrive 백업을 켜면 바탕 화면·문서가 OneDrive 아래로 옮겨진다.
const KNOWN = [
  ['desktop', ['Desktop', '바탕 화면']],
  ['downloads', null],
  ['documents', ['Documents', '문서']],
];

/**
 * 가져오기 창 '내 PC' 탭의 첫 화면: 사용자별 바탕 화면·다운로드·문서·사용자 폴더 + 드라이브(/mnt/<문자>).
 * @returns {{favorites:{kind:'desktop'|'downloads'|'documents'|'home', path:string}[], drives:{letter:string, path:string}[]}}
 */
export function windowsPlaces({ usersBase = '/mnt/c/Users', mntBase = '/mnt' } = {}) {
  const favorites = [];
  for (const u of windowsHomes(usersBase)) {
    for (const [kind, names] of KNOWN) {
      const tries = names
        ? [...oneDrives(u).flatMap((o) => names.map((n) => path.join(o, n))), ...names.map((n) => path.join(u, n))]
        : [path.join(u, 'Downloads')];
      const hit = tries.find(isDir);
      if (hit) favorites.push({ kind, path: hit });
    }
    favorites.push({ kind: 'home', path: u });
  }
  let drives = [];
  try {
    drives = fs.readdirSync(mntBase).filter((n) => /^[a-z]$/i.test(n) && isDir(path.join(mntBase, n))).sort()
      .map((n) => ({ letter: n.toUpperCase(), path: path.join(mntBase, n) }));
  } catch { /* /mnt 없음 */ }
  return { favorites, drives };
}
