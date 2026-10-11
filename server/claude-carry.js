// server/claude-carry.js
// 프로젝트 폴더를 옮길 때(가져오기·이름 바꾸기) claude 쪽 기록이 따라가게 돕는다. 절대 throw 안 함.
// - 대화 기록 폴더(~/.claude/projects/<encode(경로)>)는 영숫자 외 문자를 '-' 로 바꾼 이름이라
//   한글·공백 경로는 다른 폴더와 이름이 겹칠 수 있다 → 기록 안의 cwd 로 정말 이 폴더 것인지 가린다.
// - ~/.claude.json 의 projects[경로] 에 폴더 신뢰·local MCP·도구 허용이 있다 → 새 경로로 복사.
import fs from 'node:fs';
import path from 'node:path';

const HEAD_BYTES = 256 * 1024; // cwd 는 기록 앞부분에 나온다

// 세션 기록(.jsonl) 앞부분에서 처음 나오는 cwd. 없으면 null
function firstCwd(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    const m = /"cwd":"((?:[^"\\]|\\.)*)"/.exec(buf.subarray(0, n).toString('utf8'));
    return m ? JSON.parse(`"${m[1]}"`) : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* 무시 */ }
  }
}

/**
 * 대화 기록 폴더가 누구 것인가.
 * @returns {'none'|'mine'|'mixed'} none = 기록 폴더 없음, mine = 모두 from 에서 시작한 기록(대화 없이 메모리만 있어도),
 *   mixed = 다른 폴더 기록이 섞임
 */
export function sessionOwner(dir, from) {
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { return 'none'; }
  for (const f of files) {
    const cwd = firstCwd(path.join(dir, f));
    if (cwd !== null && cwd !== from) return 'mixed';
  }
  return 'mine';
}

// 폴더별 설정 중 옮길 것(사용 통계·마지막 비용 같은 기록은 빼고)
const CARRY_KEYS = [
  'hasTrustDialogAccepted', 'mcpServers', 'enabledMcpjsonServers', 'disabledMcpjsonServers', 'mcpContextUris',
  'allowedTools', 'hasClaudeMdExternalIncludesApproved', 'hasClaudeMdExternalIncludesWarningShown',
];

/**
 * ~/.claude.json 의 projects[from] 설정을 projects[target] 으로 복사(옛 항목은 그대로 둠).
 * 새 경로 항목이 이미 있으면 건드리지 않는다. 깨진 파일은 쓰지 않는다.
 * @returns {{ok:true, carried:boolean} | {ok:false, error:string}}
 */
export function carryClaudeConfig(file, from, target) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return { ok: true, carried: false }; }
  let j;
  try { j = JSON.parse(raw); } catch (e) { return { ok: false, error: e.message }; }
  const projects = j && typeof j.projects === 'object' && j.projects ? j.projects : null;
  const old = projects?.[from];
  if (!old || projects[target]) return { ok: true, carried: false };
  const next = {};
  for (const k of CARRY_KEYS) if (old[k] !== undefined) next[k] = old[k];
  if (!Object.keys(next).length) return { ok: true, carried: false };
  projects[target] = next;
  try {
    const tmp = `${file}.launcher-${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(j, null, 2), { mode: fs.statSync(file).mode });
    fs.renameSync(tmp, file); // 한 번에 바꿔 끼워 반쯤 쓴 파일이 남지 않게
    return { ok: true, carried: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
