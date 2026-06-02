// server/scanner.js
import fs from 'node:fs';
import path from 'node:path';

/** projectsRoot 직속 디렉토리 목록 [{name, path}] — 숨김/파일 제외, 이름순 */
export function list(projectsRoot) {
  let entries;
  try {
    entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => !e.name.startsWith('.'))
    .filter((e) => {
      try {
        // 심볼릭 링크도 디렉토리면 포함
        return fs.statSync(path.join(projectsRoot, e.name)).isDirectory();
      } catch {
        return false;
      }
    })
    .map((e) => ({ name: e.name, path: path.join(projectsRoot, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
