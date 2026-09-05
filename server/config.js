// server/config.js
// 사용자 설정 파일(~/.config/project-launcher/config.json). 지금은 projectsRoot 하나.
// 우선순위: PROJECTS_ROOT 환경변수 > 설정 파일 > ~/projects (env.js 가 조합)
// 절대 throw 안 함. 파일 경로 주입으로 테스트 가능.
import fs from 'node:fs';
import path from 'node:path';

/** 설정 파일 경로: $XDG_CONFIG_HOME/project-launcher/config.json (기본 ~/.config) */
export function configPath(processEnv, home) {
  const base = processEnv.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(base, 'project-launcher', 'config.json');
}

/** 설정 읽기. 없음/깨짐/객체 아님 → {} */
export function readConfig(file) {
  try {
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** 설정 일부 갱신(merge) 후 저장. {ok} | {ok:false, error} */
export function writeConfig(file, patch) {
  const next = { ...readConfig(file), ...patch };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

/**
 * 사용자가 입력한 스캔 폴더 문자열을 절대경로로 정규화 (순수).
 * '~' / '~/x' / 절대 / 홈 기준 상대. 빈값 → null.
 */
export function normalizeRoot(raw, home) {
  const s = (raw || '').toString().trim();
  if (!s) return null;
  if (s === '~') return home;
  if (s.startsWith('~/')) return path.join(home, s.slice(2));
  if (path.isAbsolute(s)) return path.normalize(s);
  return path.join(home, s);
}

/**
 * 스캔 폴더로 쓸 수 있는지 검사. {ok, path, warning?} | {ok:false, error}
 * - 존재하는 디렉토리여야 함
 * - /mnt/<drive>/ 아래(Windows 파일시스템)는 동작하지만 느리고 claude 함정이 있어 경고
 */
export function validateRoot(raw, home) {
  const full = normalizeRoot(raw, home);
  if (!full) return { ok: false, error: 'empty' };
  try {
    if (!fs.statSync(full).isDirectory()) return { ok: false, error: 'not a directory' };
  } catch {
    return { ok: false, error: 'not found' };
  }
  const warning = /^\/mnt\/[a-zA-Z]\//.test(full) ? 'windows-fs' : undefined;
  return warning ? { ok: true, path: full, warning } : { ok: true, path: full };
}
