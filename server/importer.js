// server/importer.js
// 다른 곳의 작업 폴더를 ~/projects 로 들여온다 (mutating). 절대 throw 안 함.
// - WSL 안의 폴더 → 이동(같은 디스크라 즉시, 원래 자리는 비워짐)
// - Windows 폴더(/mnt/<드라이브>/…) → 복사(원본 유지). node_modules 는 빼고 — 다시 설치하면 되고,
//   Windows 에서 설치한 것은 WSL 에서 오히려 고장 난다.
// - claude 대화 이력(~/.claude/projects/<인코딩된 경로>)도 같은 방식(이동/복사)으로 따라간다.
//   단 그 이름의 기록이 이미 있거나(예전에 지운 같은 이름) 다른 폴더 기록과 섞여 있으면 건드리지 않는다.
// - ~/.claude.json 의 폴더별 설정(신뢰·local MCP)도 새 경로로 복사.
// - 링크(심볼릭 링크·junction)는 실제 폴더 기준으로 검사·복사하고, 이동은 하지 않는다.
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { isValidName } from './paths.js';
import { encode } from './session.js';
import { originRepo } from './git.js';
import { sessionOwner, carryClaudeConfig } from './claude-carry.js';

const WINDOWS_FS = /^\/mnt\/[a-zA-Z]\//;
const execFileP = promisify(execFile);
const SKIP_COPY = new Set(['node_modules']);

/** 이 경로를 가져오면 복사인가 이동인가 (순수) */
export function importMode(p) {
  return WINDOWS_FS.test(p) ? 'copy' : 'move';
}

// a 가 b 와 같거나 b 의 상위 폴더인가
const containsOrSame = (a, b) => a === b || b.startsWith(a.endsWith('/') ? a : a + '/');

// 프로젝트 하나로 보기엔 너무 넓은 폴더: 루트, 홈과 그 상위, /mnt·드라이브 최상위·Windows 사용자 목록·사용자 폴더
function tooBroad(p, home) {
  if (containsOrSame(p, home)) return true;
  return /^\/mnt(\/[a-zA-Z](\/Users(\/[^/]+)?)?)?$/i.test(p);
}

// verbatimSymlinks: 안쪽 상대 링크를 원본(/mnt/…) 절대경로로 바꾸지 않고 그대로
const defaultCopy = (src, target, filter) =>
  fs.promises.cp(src, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true, verbatimSymlinks: true, filter });

// 가져올 수 있는 폴더인지 (이름·대상 검사 전 공통). {ok:true, from(실제 경로), root, mode} | {ok:false, error}
// 링크는 실제 폴더 경로로 풀어 검사한다(실행 중 감지·자기 폴더 보호도 실제 경로 기준). 링크를 이동하면
// 엉뚱한 실제 폴더가 옮겨지므로 이동은 거절, 복사는 실제 폴더를 복사(원본은 그대로).
function checkSource(src, projectsRoot, home, isWindows) {
  if (typeof src !== 'string' || !path.isAbsolute(src)) return { ok: false, error: 'not found' };
  const given = path.resolve(src);
  if (tooBroad(given, home)) return { ok: false, error: 'too broad' };
  let from;
  try {
    from = fs.realpathSync(given);
    if (!fs.statSync(from).isDirectory()) return { ok: false, error: 'not a directory' };
  } catch {
    return { ok: false, error: 'not found' };
  }
  const root = path.resolve(projectsRoot);
  if (tooBroad(from, home)) return { ok: false, error: 'too broad' };
  if (containsOrSame(root, from)) return { ok: false, error: 'inside projects' };
  if (containsOrSame(from, root)) return { ok: false, error: 'too broad' };
  if (path.basename(from).startsWith('.')) return { ok: false, error: 'hidden' }; // ~/.claude·~/.ssh 같은 설정 폴더
  const mode = isWindows(from) ? 'copy' : 'move';
  if (mode === 'move' && from !== given) return { ok: false, error: 'symlink' };
  return { ok: true, from, root, mode };
}

const sessPath = (home, p) => path.join(home, '.claude', 'projects', encode(p));

const isRepoDir = (p) => { try { return fs.statSync(path.join(p, '.git')).isDirectory(); } catch { return false; } };

/**
 * 가져오기 전 점검(읽기 전용) — 화면이 확인 문구를 만들 재료.
 * existing = 지금 카드들 [{name, github}] — 같은 GitHub 저장소가 이미 카드로 있으면 duplicateOf.
 * children = 이 폴더가 저장소가 아닐 때, 안에 든 git 저장소들(여러 프로젝트를 담은 폴더 → 각각 가져오기)
 * @returns {Promise<{ok:true, path, name, mode, isRepo, github, duplicateOf, nameTaken, children} | {ok:false, error}>}
 */
export async function inspectImport({ projectsRoot, home, src, existing = [], isWindows = (p) => WINDOWS_FS.test(p) }) {
  const c = checkSource(src, projectsRoot, home, isWindows);
  if (!c.ok) return c;
  const name = path.basename(c.from);
  const isRepo = isRepoDir(c.from);
  const github = isRepo ? await originRepo(c.from) : null;
  const dup = github ? existing.find((p) => p.github && p.github.toLowerCase() === github.toLowerCase()) : null;
  let children = [];
  if (!isRepo) {
    try {
      children = fs.readdirSync(c.from, { withFileTypes: true })
        .filter((e) => !e.name.startsWith('.') && e.isDirectory() && !SKIP_COPY.has(e.name))
        .filter((e) => isRepoDir(path.join(c.from, e.name)))
        .map((e) => path.join(c.from, e.name))
        .sort((a, b) => a.localeCompare(b));
    } catch { /* 못 읽으면 단일 폴더로 */ }
  }
  return {
    ok: true, path: c.from, name, mode: c.mode, isRepo, github,
    duplicateOf: dup ? dup.name : null, nameTaken: fs.existsSync(path.join(c.root, name)), children,
    // 그 이름의 대화 기록이 이미 있음(예전에 지운 같은 이름) → 새 이름을 받아야 옛 대화를 이어받지 않는다
    historyTaken: fs.existsSync(sessPath(home, path.join(c.root, name))),
    // 이 폴더의 대화 기록이 이름이 겹치는 다른 폴더 기록과 섞여 있음 → 기록은 옮기지 않는다
    historyShared: sessionOwner(sessPath(home, c.from), c.from) === 'mixed',
  };
}

/**
 * Windows git(autocrlf)으로 체크아웃된 저장소를 WSL 로 가져오면 모든 파일이 줄바꿈(CRLF) 때문에 "변경됨"으로 잡힌다.
 * 작업 트리 파일이 커밋된 내용과 줄바꿈만 다르면 커밋된 내용(LF)으로 되돌린다. 실제로 고친 파일은 건드리지 않는다.
 * @returns {Promise<{fixed:string[]}>}
 */
export async function fixCrlfOnly(dir) {
  const git = (args, encoding = 'utf8') =>
    execFileP('git', ['-C', dir, ...args], { encoding, maxBuffer: 256 * 1024 * 1024, timeout: 60000 });
  let names;
  try {
    names = (await git(['diff', '--name-only', '-z'])).stdout.split('\0').filter(Boolean);
  } catch {
    return { fixed: [] }; // 저장소가 아님 등
  }
  const fixed = [];
  for (const f of names) {
    const full = path.join(dir, f);
    try {
      if (!fs.lstatSync(full).isFile()) continue;
      const work = fs.readFileSync(full);
      if (!work.includes(13)) continue; // CR 이 없으면 줄바꿈 문제가 아님
      const committed = (await git(['show', `:${f}`], 'buffer')).stdout;
      const lf = Buffer.from(work.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
      if (lf.equals(committed)) {
        fs.writeFileSync(full, committed);
        fixed.push(f);
      }
    } catch { /* 이 파일은 그대로 */ }
  }
  // Windows git 이 만든 색인엔 CRLF 시절 크기가 남아 계속 '변경됨'으로 보인다 → 색인과 같은 내용이니 다시 add 해 갱신
  if (fixed.length) {
    try { await git(['add', '--', ...fixed]); } catch { /* 표시만 남을 뿐 */ }
  }
  return { fixed };
}

/**
 * @returns {Promise<{ok:true, name:string, path:string, mode:'move'|'copy'} | {ok:false, error:string}>}
 */
export async function importFolder({
  projectsRoot, home, src, name,
  isRunning = () => false, selfDir = null,
  isWindows = (p) => WINDOWS_FS.test(p), copy = defaultCopy, claudeJson = null,
}) {
  const c = checkSource(src, projectsRoot, home, isWindows);
  if (!c.ok) return c;
  const { from, root, mode } = c;
  const finalName = name ?? path.basename(from);
  if (!isValidName(finalName) || finalName.startsWith('.')) return { ok: false, error: 'invalid name' }; // 숨김 폴더는 카드로 안 보임
  const target = path.join(root, finalName);
  if (fs.existsSync(target)) return { ok: false, error: 'already exists' };

  const oldSess = sessPath(home, from);
  const newSess = sessPath(home, target);
  if (fs.existsSync(newSess)) return { ok: false, error: 'history taken' };
  const owner = sessionOwner(oldSess, from); // mixed 면 기록은 제자리
  const carry = () => {
    const r = carryClaudeConfig(claudeJson ?? path.join(home, '.claude.json'), from, target);
    if (!r.ok) console.warn(`[importer] claude 설정 복사 실패 (${finalName}):`, r.error);
  };
  const done = (extra = {}) => ({ ok: true, name: finalName, path: target, mode, ...(owner === 'mixed' ? { historyKept: true } : {}), ...extra });

  if (mode === 'move') {
    if (isRunning(from)) return { ok: false, error: 'running' };
    const self = selfDir && path.resolve(selfDir);
    if (self && (containsOrSame(from, self) || containsOrSame(self, from))) return { ok: false, error: 'self' }; // 런처를 품은 폴더·런처 안의 폴더
    try {
      fs.renameSync(from, target);
    } catch (e) {
      return { ok: false, error: e.code === 'EXDEV' ? 'cross-device' : (e.message || 'move failed') };
    }
    if (owner === 'mine') {
      try { fs.renameSync(oldSess, newSess); } catch (e) { console.warn(`[importer] 이력 이동 실패 (${finalName}):`, e.message); }
    }
    carry();
    return done();
  }

  try {
    await copy(from, target, (s) => !SKIP_COPY.has(path.basename(s)));
  } catch (e) {
    fs.rmSync(target, { recursive: true, force: true }); // 만들다 만 폴더 정리
    return { ok: false, error: e.message || 'copy failed' };
  }
  if (owner === 'mine') {
    try { fs.cpSync(oldSess, newSess, { recursive: true }); } catch (e) { console.warn(`[importer] 이력 복사 실패 (${finalName}):`, e.message); }
  }
  carry();
  // Windows 에서 체크아웃된 파일의 줄바꿈 차이 정리(복사본에서만 — 원본은 그대로)
  const { fixed } = isRepoDir(target) ? await fixCrlfOnly(target) : { fixed: [] };
  return done(fixed.length ? { crlfFixed: fixed.length } : {});
}
