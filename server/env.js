// server/env.js
import { execSync } from 'node:child_process';
import path from 'node:path';
import { normalizeRoot } from './config.js';

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

const WINDOWS_FS = /^\/mnt\/[a-zA-Z]\//;

/**
 * 스캔할 프로젝트 루트 결정. 작업 폴더는 WSL 안의 $HOME/projects 로 고정한다.
 * - PROJECTS_ROOT 환경변수(테스트·개발용)는 존중하되 Windows 폴더(/mnt/…)면 무시
 * - 예전 '스캔 폴더 변경' 설정 파일 값은 쓰지 않는다(다른 곳의 프로젝트는 ⬇ 가져오기로)
 */
function resolveProjectsRoot(processEnv, home) {
  const def = path.join(home, 'projects');
  const fromEnv = normalizeRoot(processEnv.PROJECTS_ROOT, home);
  if (fromEnv && !WINDOWS_FS.test(fromEnv)) return { projectsRoot: fromEnv, projectsRootSource: 'env' };
  return { projectsRoot: def, projectsRootSource: 'default' };
}

/**
 * 환경 감지 (의존성 주입으로 테스트 가능).
 * @param {object} processEnv  보통 process.env
 * @param {() => string} fallbackDistro  WSL_DISTRO_NAME 없을 때 호출
 */
export function detectEnv(processEnv, fallbackDistro = defaultFallback) {
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
    ...resolveProjectsRoot(processEnv, home),
  };
}
