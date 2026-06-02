// server/session.js
import fs from 'node:fs';
import path from 'node:path';

/** 절대경로를 claude 세션 디렉토리명으로 인코딩 (영숫자 외 → '-') */
export function encode(absPath) {
  return absPath.replace(/[^a-zA-Z0-9]/g, '-');
}

/** <home>/.claude/projects/<encoded>/ 안에 .jsonl 세션이 하나라도 있으면 true */
export function hasSession(home, absProjectPath) {
  const dir = path.join(home, '.claude', 'projects', encode(absProjectPath));
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.jsonl'));
  } catch {
    return false;
  }
}
