// server/order.js
// 사용자가 드래그로 정한 카드 순서(프로젝트명 배열)를 중앙 JSON 에 저장/조회한다. 절대 throw 안 함.
// 빈 배열 = 이름순(기본). 목록에 없는 프로젝트(새로 생긴 것)는 화면에서 구역 맨 앞에 놓인다(project-group.js).
import fs from 'node:fs';
import path from 'node:path';

/** 순서 읽기. 파일 없음/깨짐/배열아님 → []. 문자열만 남긴다. */
export function readOrder(file) {
  try {
    const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(arr) ? arr.filter((n) => typeof n === 'string' && n) : [];
  } catch {
    return [];
  }
}

/**
 * 순서 저장. 빈 배열이면 파일을 지워 이름순으로 되돌린다. 중복은 첫 위치만 남긴다.
 * @returns {{ok:true} | {ok:false, error:string}}
 */
export function writeOrder(file, names) {
  if (!Array.isArray(names) || !names.every((n) => typeof n === 'string' && n)) {
    return { ok: false, error: 'invalid order' };
  }
  try {
    if (names.length === 0) {
      fs.rmSync(file, { force: true });
      return { ok: true };
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify([...new Set(names)], null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

/** 이름 변경 시 같은 자리를 유지하도록 oldName → newName 치환. 목록에 없으면 no-op. */
export function renameInOrder(file, oldName, newName) {
  const order = readOrder(file);
  const i = order.indexOf(oldName);
  if (i === -1) return { ok: true };
  order[i] = newName;
  return writeOrder(file, order);
}
