// server/running.js
import fs from 'node:fs';
import path from 'node:path';

/**
 * 이 PC 에서 claude(comm==='claude')가 열려 있는 프로젝트들의 절대 cwd 모음.
 * procRoot 주입으로 테스트 가능(기본 '/proc'). 절대 throw 하지 않음(최악의 경우 빈 Set).
 * @returns {Set<string>}
 */
export function runningPaths(procRoot = '/proc') {
  const set = new Set();
  let pids;
  try {
    pids = fs.readdirSync(procRoot);
  } catch {
    return set;
  }
  for (const pid of pids) {
    if (!/^\d+$/.test(pid)) continue; // 숫자 PID 만
    try {
      const comm = fs.readFileSync(path.join(procRoot, pid, 'comm'), 'utf8').trim();
      if (comm !== 'claude') continue;
      const cwd = fs.readlinkSync(path.join(procRoot, pid, 'cwd'));
      set.add(cwd);
    } catch {
      // 권한/경쟁(프로세스 종료 중)/cwd 없음 → 건너뜀
    }
  }
  return set;
}

/**
 * runSet 안에 projectPath 와 정확히 같거나 그 하위인 cwd 가 있으면 true (순수).
 * @param {Set<string>} runSet
 * @param {string} projectPath
 * @returns {boolean}
 */
export function isRunning(runSet, projectPath) {
  const prefix = projectPath + path.sep;
  for (const cwd of runSet) {
    if (cwd === projectPath || cwd.startsWith(prefix)) return true;
  }
  return false;
}
