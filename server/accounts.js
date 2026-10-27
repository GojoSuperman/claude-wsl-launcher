// server/accounts.js
// 여러 계정 목록(accounts.json)과 계정 폴더 관리. 절대 throw 안 함(결과 객체로 보고).
// - 기본 계정 = 항상 ~/.claude (+ ~/.claude.json), id 'default'. 목록(accounts)에는 넣지 않는다.
// - 추가 계정 = ~/.claude-acct-N (N 은 2부터 비어 있는 첫 번호), id 'aN'.
// - 이메일은 저장하지 않고 각 계정의 .claude.json → oauthAccount.emailAddress 에서 매번 읽는다.
// - '목록에서 빼기'는 목록에서만 제거한다(폴더·로그인 정보 보존).
import fs from 'node:fs';
import path from 'node:path';
import { ensureSharedLinks, syncSkills } from './account-sync.js';

export const DEFAULT_ID = 'default';
const ALIAS_MAX = 40;
const EMPTY = () => ({ defaultAlias: '', accounts: [], lastByProject: {} });
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * 계정 폴더로 받아들일 경로인가. 손으로 고친 accounts.json 이 ~/.claude 내부·홈·루트를 가리키면
 * 동기화가 그 안에 링크를 흩뿌리고, cmd 특수문자는 `cmd /c start` 인자를 깨므로 형식을 좁힌다:
 * 정규화된 절대경로 + 마지막 이름이 `.claude-이름` + 경로 어디에도 cmd 특수문자·제어문자 없음.
 */
export function isAccountDir(dir) {
  return typeof dir === 'string' && path.isAbsolute(dir) && path.normalize(dir) === dir
    && /^\.claude-[A-Za-z0-9._-]+$/.test(path.basename(dir)) && !/[&|<>^"%!\x00-\x1f\x7f]/.test(dir);
}

/** 손으로 고쳤거나 깨진 상태를 안전한 형태로 정리. 잘못된 항목은 버린다. */
export function normalizeAccounts(raw) {
  const out = EMPTY();
  if (!raw || typeof raw !== 'object') return out;
  out.defaultAlias = str(raw.defaultAlias).slice(0, ALIAS_MAX);
  const ids = new Set();
  for (const a of Array.isArray(raw.accounts) ? raw.accounts : []) {
    const id = str(a?.id);
    const dir = typeof a?.dir === 'string' ? a.dir : '';
    if (!id || id === DEFAULT_ID || ids.has(id) || !isAccountDir(dir)) continue;
    ids.add(id);
    out.accounts.push({ id, dir, alias: str(a.alias).slice(0, ALIAS_MAX) });
  }
  const last = raw.lastByProject && typeof raw.lastByProject === 'object' && !Array.isArray(raw.lastByProject)
    ? raw.lastByProject : {};
  for (const [name, id] of Object.entries(last)) {
    if (name && ids.has(id)) out.lastByProject[name] = id;
  }
  return out;
}

export function readAccounts(file) {
  try {
    return normalizeAccounts(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return EMPTY();
  }
}

export function writeAccounts(file, state) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // 기존 파일이 깨져 있으면(손으로 고치다 오타 등) 빈 목록으로 덮어쓰기 전에 보존 — 등록 계정 유실 방지
    let raw = null;
    try { raw = fs.readFileSync(file, 'utf8'); } catch { /* 없음 */ }
    if (raw !== null) {
      try { JSON.parse(raw); } catch { fs.renameSync(file, `${file}.bad-${Date.now()}`); }
    }
    const tmp = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(normalizeAccounts(state), null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

export function readEmail(claudeJsonPath) {
  return readLogin(claudeJsonPath).email;
}

/**
 * 그 계정 칸이 로그인한 계정·조직. 이메일 하나가 개인 계정과 조직(학교·회사)에 함께 속할 수 있어
 * 이메일만으로는 어느 쪽으로 로그인했는지 모른다 → 조직 이름·id·종류도 읽는다(토큰은 읽지 않음).
 * @returns {{email:string, org:string, orgId:string, orgType:string}}
 */
export function readLogin(claudeJsonPath) {
  const str = (v) => (typeof v === 'string' ? v : '');
  try {
    const o = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'))?.oauthAccount || {};
    return { email: str(o.emailAddress), org: str(o.organizationName), orgId: str(o.organizationUuid), orgType: str(o.organizationType) };
  } catch {
    return { email: '', org: '', orgId: '', orgType: '' };
  }
}

/**
 * 같은 이메일·같은 조직으로 로그인한 칸들의 묶음(2칸 이상만). 계정을 나눠 놓고 실제로는 한 곳에 로그인한 '섞임' 경고용.
 * 조직 정보가 없으면 이메일만으로 묶는다. 로그인 안 한 칸은 제외.
 * @returns {string[][]} 계정 id 묶음들
 */
export function sameOrgGroups(list) {
  const by = new Map();
  for (const a of list) {
    if (!a.loggedIn || !a.email) continue;
    const k = `${a.email.toLowerCase()}|${a.orgId || ''}`;
    by.set(k, [...(by.get(k) || []), a.id]);
  }
  return [...by.values()].filter((ids) => ids.length > 1);
}

/** 기본 계정 + 추가 계정. 이메일·조직·로그인 여부·폴더 존재를 그때그때 채운다. */
export function listAccounts(home, state) {
  const def = { id: DEFAULT_ID, dir: path.join(home, '.claude'), alias: state.defaultAlias, isDefault: true };
  const list = [def, ...state.accounts.map((a) => ({ ...a, isDefault: false }))].map((a) => {
    const login = readLogin(a.isDefault ? path.join(home, '.claude.json') : path.join(a.dir, '.claude.json'));
    return { ...a, ...login, loggedIn: !!login.email, exists: a.isDefault || fs.existsSync(a.dir) };
  });
  // 다른 칸과 같은 이메일·조직으로 로그인돼 있음(나눠 둔 계정이 실제로는 한 곳) → 화면이 경고
  const dup = new Set(sameOrgGroups(list).flat());
  return list.map((a) => ({ ...a, dupLogin: dup.has(a.id) }));
}

/** 버튼·탭 제목용 짧은 이름 */
export function accountLabel(a) {
  return a.alias || a.email || '';
}

/** 새 계정 폴더를 만들고(공유 링크 포함) 목록에 등록. 실패하면 이번에 만든 폴더만 되돌린다. */
export function addAccount(home, file) {
  const state = readAccounts(file);
  let n = 2;
  let dir;
  for (;; n++) {
    dir = path.join(home, `.claude-acct-${n}`);
    const taken = state.accounts.some((a) => a.id === `a${n}` || a.dir === dir);
    if (!taken && !fs.existsSync(dir)) break;
  }
  const account = { id: `a${n}`, dir, alias: '' };
  try {
    fs.mkdirSync(dir, { mode: 0o700 }); // recursive 아님 — 이미 있으면 실패(남의 폴더를 되돌리지 않게)
  } catch (e) {
    return { ok: false, error: e.message };
  }
  try {
    ensureSharedLinks(path.join(home, '.claude'), dir);
    syncSkills(path.join(home, '.claude', 'skills'), path.join(dir, 'skills'));
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true }); // 링크는 링크만 지워지고 원본은 그대로
    return { ok: false, error: e.message };
  }
  state.accounts.push(account);
  const w = writeAccounts(file, state);
  if (!w.ok) {
    fs.rmSync(dir, { recursive: true, force: true });
    return w;
  }
  return { ok: true, account };
}

export function setAlias(file, id, alias) {
  const state = readAccounts(file);
  const value = str(alias).slice(0, ALIAS_MAX);
  if (id === DEFAULT_ID) state.defaultAlias = value;
  else {
    const a = state.accounts.find((x) => x.id === id);
    if (!a) return { ok: false, error: 'unknown account' };
    a.alias = value;
  }
  return writeAccounts(file, state);
}

export function removeAccount(file, id) {
  if (id === DEFAULT_ID) return { ok: false, error: 'cannot remove default' };
  const state = readAccounts(file);
  const a = state.accounts.find((x) => x.id === id);
  if (!a) return { ok: false, error: 'unknown account' };
  state.accounts = state.accounts.filter((x) => x.id !== id);
  const w = writeAccounts(file, state); // normalize 가 사라진 id 를 가리키는 lastByProject 도 정리
  return w.ok ? { ok: true, dir: a.dir } : w;
}

/** 실행할 계정 결정. requested 생략 → 그 프로젝트의 기억(없으면 기본). */
export function resolveLaunchAccount(state, project, requested) {
  if (requested === undefined || requested === null || requested === '') {
    return { id: state.lastByProject[project] || DEFAULT_ID };
  }
  if (requested === DEFAULT_ID || state.accounts.some((a) => a.id === requested)) return { id: requested };
  return { error: 'unknown account' };
}

export function rememberLast(file, project, id) {
  const state = readAccounts(file);
  if (id === DEFAULT_ID) delete state.lastByProject[project];
  else state.lastByProject[project] = id;
  return writeAccounts(file, state);
}

export function renameInAccounts(file, oldName, newName) {
  const state = readAccounts(file);
  if (!(oldName in state.lastByProject)) return { ok: true };
  state.lastByProject[newName] = state.lastByProject[oldName];
  delete state.lastByProject[oldName];
  return writeAccounts(file, state);
}
