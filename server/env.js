// server/env.js
import { execSync } from 'node:child_process';
import path from 'node:path';
import { configPath, readConfig, normalizeRoot } from './config.js';

/** wsl.exe -l -q 첫 줄을 폴백 distro 로 (실패 시 빈 문자열) */
function defaultFallback() {
  try {
    const out = execSync('wsl.exe -l -q', { encoding: 'utf8' });
    // UTF-16/공백/CR 정리 후 첫 비어있지 않은 줄
    return out.replace(/\0/g, '').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || '';
  } catch {
    return '';
  }
}

/**
 * 스캔할 프로젝트 루트 결정. 우선순위: PROJECTS_ROOT 환경변수 > 설정 파일 > $HOME/projects.
 * - 미설정/공백 → 기본 $HOME/projects
 * - '~' 또는 '~/sub' → 홈 기준 확장
 * - 절대경로 → 그대로(정규화)
 * - 상대경로 → 홈 기준으로 해석
 */
function resolveProjectsRoot(processEnv, home, readCfg) {
  const fromEnv = normalizeRoot(processEnv.PROJECTS_ROOT, home);
  if (fromEnv) return { projectsRoot: fromEnv, projectsRootSource: 'env' };
  const fromCfg = normalizeRoot(readCfg(configPath(processEnv, home)).projectsRoot, home);
  if (fromCfg) return { projectsRoot: fromCfg, projectsRootSource: 'config' };
  return { projectsRoot: path.join(home, 'projects'), projectsRootSource: 'default' };
}

/**
 * 환경 감지 (의존성 주입으로 테스트 가능).
 * @param {object} processEnv  보통 process.env
 * @param {() => string} fallbackDistro  WSL_DISTRO_NAME 없을 때 호출
 */
export function detectEnv(processEnv, fallbackDistro = defaultFallback, readCfg = readConfig) {
  const home = processEnv.HOME || '';
  const user = processEnv.USER || '';
  const distro = processEnv.WSL_DISTRO_NAME || fallbackDistro();
  if (!distro) {
    throw new Error('WSL distro 를 감지할 수 없습니다. WSL 안에서 실행했는지 확인하세요.');
  }
  return {
    distro,
    home,
    user,
    ...resolveProjectsRoot(processEnv, home, readCfg),
  };
}
