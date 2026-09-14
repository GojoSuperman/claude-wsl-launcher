// server/launcher.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** WSL 에서 본 cmd.exe 표준 절대경로 (PATH 에 없을 때 폴백) */
const CMD_FALLBACK = '/mnt/c/Windows/System32/cmd.exe';

/** 새 WSL 창에서 claude 를 띄우는 런처 스크립트의 절대경로 (server/ 기준 ../scripts) */
const LAUNCH_SCRIPT = path.join(import.meta.dirname, '..', 'scripts', 'launch-claude.sh');

/**
 * cmd.exe 실행 경로 결정 (순수, 의존성 주입 가능).
 * - PATH 에 cmd.exe 가 있으면 'cmd.exe' (비표준 드라이브 마운트도 커버)
 * - 없으면 표준 절대경로 폴백 (서버를 Windows PATH 없는 셸에서 띄운 경우 대비)
 *
 * powershell.exe 대신 cmd.exe 를 쓰는 이유(2026-09-14 실측): powershell 기동 1.7~2.8초,
 * cmd 는 0.4~0.7초 — 'claude 이어서 실행' 클릭 후 새 창이 뜨기까지의 지연 대부분이
 * powershell 기동비였다. `cmd /c start` 로 띄운 프로세스도 Windows 소유로 분리된다.
 */
export function resolveCmd(env = process.env, existsSync = fs.existsSync) {
  for (const dir of (env.PATH || '').split(':')) {
    if (dir && existsSync(`${dir}/cmd.exe`)) return 'cmd.exe';
  }
  if (existsSync(CMD_FALLBACK)) return CMD_FALLBACK;
  return 'cmd.exe'; // 최후 시도 — 실패 시 launch 가 reject
}

/**
 * 새 WSL 콘솔 창에서 claude 를 띄우는 cmd.exe 인자 배열 생성 (순수).
 * cont=true → claude --continue, false → claude
 *
 * `cmd /c start "" wsl.exe ...` — start 의 첫 따옴표 인자는 창 제목이므로 빈 문자열을
 * 자리채움으로 넣는다. 인자별 인용은 WSL interop 이 공백 포함 인자를 자동으로 큰따옴표로
 * 감싸므로 여기서 하지 않는다. (한계: 경로에 cmd 메타문자 `&` `^` 등이 있으면 깨질 수
 * 있으나 프로젝트 경로에선 비현실적 — 발생 시 powershell 방식으로 되돌릴 것.)
 *
 * 인라인 `bash -lic 'claude; ...'` 대신 launch-claude.sh 스크립트 파일을 호출한다.
 * 이유: 다단 호출에서 인라인 복합 명령이 망가지고, 그렇게 띄운 bash -lic 가 비대화형으로
 * 잡혀 nvm 이 로드되지 않아 `claude: command not found` 가 났다. (scripts/launch-claude.sh 참고)
 */
export function buildStartArgs(distro, projectPath, cont, scriptPath = LAUNCH_SCRIPT) {
  const args = ['/c', 'start', '', 'wsl.exe', '-d', distro, '--cd', projectPath, '--', 'bash', scriptPath];
  if (cont) args.push('--continue');
  return args;
}

/**
 * 실제 새 창 띄우기 (부수효과). 성공적으로 spawn 했으면 resolve.
 * spawn 자체 실패(ENOENT 등)는 reject.
 */
export function launch(distro, projectPath, cont) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveCmd(), buildStartArgs(distro, projectPath, cont), {
      detached: true,
      stdio: 'ignore',
    });
    child.once('error', reject);
    // spawn 직후 에러가 없으면 성공으로 간주하고 분리
    child.unref();
    // Node spawn 에러는 process.nextTick 으로 발행(check phase 보다 선행)
    // → ENOENT 등 발생 시 reject 가 먼저 정착, 이후 이 resolve() 는 no-op
    setImmediate(resolve);
  });
}
