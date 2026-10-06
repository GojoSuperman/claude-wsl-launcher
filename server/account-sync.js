// server/account-sync.js
// 추가 계정 폴더(CLAUDE_CONFIG_DIR=~/.claude-acct-N 등)를 기본 계정 ~/.claude 와 맞춘다.
// - SHARED_ITEMS 는 기본 계정을 가리키는 심볼릭 링크로 공유(대화 기록·지침·설정·플러그인…).
//   기본 쪽에 없거나 계정 쪽에 이미 실제 파일이 있으면 건드리지 않는다.
// - skills/ 는 폴더째 링크하지 않고 항목별 링크(조직 배포 skills/synced 보존).
// - .claude.json 은 로그인 정보가 들어 있어 링크 불가 → MCP 항목만 기본 → 계정 복사.
//   기본 쪽이 원본: 추가 계정에서 따로 등록한 MCP 는 다음 실행 때 덮어써진다.
// - 로그인·사용량·입력 기록·claude.ai 커넥터는 계정별(공유 안 함).
import fs from 'node:fs';
import path from 'node:path';

export const SHARED_ITEMS = ['projects', 'CLAUDE.md', 'settings.json', 'settings.local.json', 'hooks', 'plugins', 'agents', 'commands'];
const SKIP_SKILLS = new Set(['synced']);

const lexists = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };

/** baseDir 에 있는 SHARED_ITEMS 를 acctDir 에 링크(비어 있는 자리에만). 멱등. */
export function ensureSharedLinks(baseDir, acctDir) {
  const added = [];
  for (const n of SHARED_ITEMS) {
    const src = path.join(baseDir, n);
    const dst = path.join(acctDir, n);
    if (!fs.existsSync(src) || lexists(dst)) continue;
    fs.symlinkSync(src, dst);
    added.push(n);
  }
  return { added };
}

/**
 * srcDir(기본 skills) 의 각 항목을 dstDir(계정 skills) 에 심볼릭 링크로 맞춘다.
 * - dst 에 없는 항목 → 링크 추가 / srcDir 을 가리키는데 원본이 사라진 링크 → 제거
 * - 링크가 아닌 실제 파일/폴더(조직 배포분 등)는 건드리지 않는다
 */
export function syncSkills(srcDir, dstDir) {
  const added = [];
  const removed = [];
  if (!fs.existsSync(srcDir)) return { added, removed };
  fs.mkdirSync(dstDir, { recursive: true });
  for (const n of fs.readdirSync(srcDir).filter((x) => !SKIP_SKILLS.has(x))) {
    const dst = path.join(dstDir, n);
    if (!lexists(dst)) {
      fs.symlinkSync(path.join(srcDir, n), dst);
      added.push(n);
    }
  }
  for (const n of fs.readdirSync(dstDir)) {
    const dst = path.join(dstDir, n);
    if (!fs.lstatSync(dst).isSymbolicLink()) continue;
    const target = path.resolve(dstDir, fs.readlinkSync(dst));
    if (path.dirname(target) === path.resolve(srcDir) && !fs.existsSync(target)) {
      fs.unlinkSync(dst);
      removed.push(n);
    }
  }
  return { added, removed };
}

/**
 * 기본 .claude.json 의 MCP 설정을 계정 .claude.json 에 반영한 새 객체 (순수).
 * - 사용자 스코프 mcpServers: 기본 것으로 교체
 * - 프로젝트(local) 스코프 projects[경로].mcpServers: 기본 쪽에 있는 프로젝트만 교체
 */
export function mergeMcp(base, acct) {
  const next = { ...acct, mcpServers: base.mcpServers ?? {} };
  const projects = { ...(acct.projects ?? {}) };
  for (const [p, cfg] of Object.entries(base.projects ?? {})) {
    if (!cfg?.mcpServers || Object.keys(cfg.mcpServers).length === 0) continue;
    projects[p] = { ...(projects[p] ?? {}), mcpServers: cfg.mcpServers };
  }
  if (acct.projects || Object.keys(projects).length) next.projects = projects;
  return { next, changed: JSON.stringify(next) !== JSON.stringify(acct) };
}

/** 파일 단위 MCP 동기화. 계정에 한 번도 로그인하지 않아 파일이 없으면 건너뜀. */
export function syncMcp(baseFile, acctFile) {
  if (!fs.existsSync(baseFile) || !fs.existsSync(acctFile)) return { changed: false };
  const { next, changed } = mergeMcp(
    JSON.parse(fs.readFileSync(baseFile, 'utf8')),
    JSON.parse(fs.readFileSync(acctFile, 'utf8')),
  );
  if (changed) {
    const tmp = `${acctFile}.tmp-${process.pid}`; // 원자적 교체(claude 가 반쪽 JSON 을 보지 않게)
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, acctFile);
  }
  return { changed };
}

const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };

/**
 * 추가 계정으로 실행하기 직전 한 번 — 링크 보충 + 스킬 + MCP.
 * 계정 폴더가 기본 계정 자체·그 내부·홈 자체면(링크 경유 포함) 아무것도 하지 않는다 —
 * 그런 곳에 링크를 만들면 ~/.claude 안에 자기 참조 고리나 홈에 설정 링크가 생긴다.
 */
export function syncAccount(home, acctDir) {
  const base = path.join(home, '.claude');
  const acctReal = real(acctDir);
  const baseReal = real(base);
  if (acctReal === baseReal || acctReal.startsWith(baseReal + path.sep) || acctReal === real(home)) {
    return { skipped: true };
  }
  const links = ensureSharedLinks(base, acctDir);
  const skills = syncSkills(path.join(base, 'skills'), path.join(acctDir, 'skills'));
  const mcp = syncMcp(path.join(home, '.claude.json'), path.join(acctDir, '.claude.json'));
  return { links, skills, mcp };
}
