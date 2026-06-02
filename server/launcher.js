// server/launcher.js
import { spawn } from 'node:child_process';
import fs from 'node:fs';

/** WSL 에서 본 powershell.exe 표준 절대경로 (PATH 에 없을 때 폴백) */
const PS_FALLBACK = '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';

/**
 * powershell.exe 실행 경로 결정 (순수, 의존성 주입 가능).
 * - PATH 에 powershell.exe 가 있으면 'powershell.exe' (비표준 드라이브 마운트도 커버)
 * - 없으면 표준 절대경로 폴백 (서버를 Windows PATH 없는 셸에서 띄운 경우 대비)
 */
export function resolvePowershell(env = process.env, existsSync = fs.existsSync) {
  for (const dir of (env.PATH || '').split(':')) {
    if (dir && existsSync(`${dir}/powershell.exe`)) return 'powershell.exe';
  }
  if (existsSync(PS_FALLBACK)) return PS_FALLBACK;
  return 'powershell.exe'; // 최후 시도 — 실패 시 launch 가 reject
}

/** PowerShell 단일인용 문자열용 이스케이프: ' → '' */
function psQuote(arg) {
  return `'${String(arg).replace(/'/g, "''")}'`;
}

/**
 * 새 WSL 콘솔 창에서 claude 를 띄우는 PowerShell 스크립트 문자열 생성 (순수).
 * cont=true → claude --continue, false → claude
 */
export function buildPsScript(distro, projectPath, cont) {
  const bashCmd = `claude${cont ? ' --continue' : ''}; exec bash -i`;
  const wslArgs = ['-d', distro, '--cd', projectPath, '--', 'bash', '-lic', bashCmd];
  const argList = wslArgs.map(psQuote).join(',');
  return `Start-Process wsl.exe -ArgumentList ${argList}`;
}

/**
 * 실제 새 창 띄우기 (부수효과). 성공적으로 spawn 했으면 resolve.
 * spawn 자체 실패(ENOENT 등)는 reject.
 */
export function launch(distro, projectPath, cont) {
  return new Promise((resolve, reject) => {
    const psScript = buildPsScript(distro, projectPath, cont);
    const child = spawn(resolvePowershell(), ['-NoProfile', '-Command', psScript], {
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
