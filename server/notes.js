// server/notes.js
// 프로젝트별 한글 메모를 중앙 JSON 에 저장/조회한다. 절대 throw 안 함. 파일 경로 주입(테스트 가능).
import fs from 'node:fs';
import path from 'node:path';

/** notes JSON 읽기. 파일 없음/깨짐/객체아님 → {}. */
export function readAll(file) {
  try {
    const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/**
 * name 의 메모 설정. note 를 trim 후, 빈값이면 키 삭제. 디렉토리 자동 생성 후 기록.
 * @returns {{ok:true} | {ok:false, error:string}}
 */
export function setNote(file, name, note) {
  if (typeof name !== 'string' || !name) return { ok: false, error: 'invalid name' };
  const all = readAll(file);
  const trimmed = (typeof note === 'string' ? note : '').trim();
  if (trimmed) all[name] = trimmed;
  else delete all[name];
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

/** 메모 키를 oldName → newName 으로 옮긴다. 메모 없으면 no-op. {ok, error?} */
export function renameNote(file, oldName, newName) {
  const all = readAll(file);
  if (!(oldName in all)) return { ok: true };
  all[newName] = all[oldName];
  delete all[oldName];
  try {
    fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}
