// server/tab-colors.js
// 프로젝트별 터미널 탭 색(#rrggbb)을 중앙 JSON 에 저장/조회한다. 절대 throw 안 함. 파일 경로 주입(테스트 가능).
// 색은 claude 실행 때 launch-claude.sh --color 로 넘어가 Windows Terminal 탭을 칠한다.
import fs from 'node:fs';
import path from 'node:path';

/** '#RRGGBB' / 'rrggbb' → '#rrggbb', 그 밖은 null (스크립트 인자로 넘어가므로 엄격하게) */
export function normalizeColor(c) {
  if (typeof c !== 'string') return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(c);
  return m ? `#${m[1].toLowerCase()}` : null;
}

/** 탭 색 JSON 읽기. 없음/깨짐 → {} */
export function readColors(file) {
  try {
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function write(file, all) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

/** name 의 탭 색 설정. color 가 null 이면 지움(색 없음). {ok, color} | {ok:false, error} */
export function setColor(file, name, color) {
  if (typeof name !== 'string' || !name) return { ok: false, error: 'invalid name' };
  const all = readColors(file);
  if (color === null) {
    delete all[name];
  } else {
    const c = normalizeColor(color);
    if (!c) return { ok: false, error: 'invalid color' };
    all[name] = c;
  }
  const w = write(file, all);
  return w.ok ? { ok: true, color: all[name] ?? null } : w;
}

/** 이름 바꾸기: 색이 따라간다. 없으면 no-op */
export function renameColor(file, oldName, newName) {
  const all = readColors(file);
  if (!(oldName in all)) return { ok: true };
  all[newName] = all[oldName];
  delete all[oldName];
  return write(file, all);
}

/** 삭제된 프로젝트의 색 지우기. 없으면 no-op */
export function removeColor(file, name) {
  const all = readColors(file);
  if (!(name in all)) return { ok: true };
  delete all[name];
  return write(file, all);
}
