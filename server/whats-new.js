// server/whats-new.js
// '새 기능' 창: 사용자가 마지막으로 [확인]한 소식 id 를 상태 파일에 기억한다(브라우저 포트가 바뀌어도 유지).
// 절대 throw 안 함.
import fs from 'node:fs';
import path from 'node:path';
import { normalizeRoot } from './config.js';

/** 마지막으로 본 소식 id. 없음/깨짐 → null */
export function readSeen(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, 'utf8'))?.seen;
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}

/** 본 소식 id 기록. {ok} | {ok:false, error} */
export function writeSeen(file, id) {
  if (typeof id !== 'string' || !id) return { ok: false, error: 'invalid id' };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ seen: id }) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

const WINDOWS_FS = /^\/mnt\/[a-zA-Z]\//;
// 런처를 써 온 흔적(첫 실행에 생기는 server.log 는 빼고)
const USE_TRACES = ['notes.json', 'order.json', 'tabs.json', 'accounts.json'];
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

/**
 * 새 기능 창용 사용자 판단.
 * existing = 기존 사용자(업데이트) — 프로젝트가 있거나, 런처를 써 온 흔적이나 예전 설정 파일이 있음.
 * legacyRoot = 예전에 바꿔 쓰던 스캔 폴더(설정 파일 값, 또는 이제 무시되는 /mnt 환경변수). 실제로 있을 때만.
 *   → 작업 폴더가 ~/projects 로 고정되며 카드가 안 보이게 된 사용자에게 어디서 가져오면 되는지 알려 준다.
 * @returns {{existing:boolean, legacyRoot:string|null}}
 */
export function userHistory({ stateDir, configFile, home, projectsRoot, envRoot, hasProjects, isWindows = (p) => WINDOWS_FS.test(p) }) {
  let cfgRoot;
  let hasConfig = false;
  try {
    hasConfig = fs.existsSync(configFile);
    cfgRoot = normalizeRoot(JSON.parse(fs.readFileSync(configFile, 'utf8'))?.projectsRoot, home);
  } catch { cfgRoot = null; }
  const env = normalizeRoot(envRoot, home);
  const root = path.resolve(projectsRoot);
  const candidates = [cfgRoot, env && isWindows(env) ? env : null].filter(Boolean).map((p) => path.resolve(p));
  const legacyRoot = candidates.find((p) => p !== root && isDir(p)) ?? null;
  const traces = USE_TRACES.some((f) => fs.existsSync(path.join(stateDir, f)));
  return { existing: Boolean(hasProjects || traces || hasConfig), legacyRoot };
}
