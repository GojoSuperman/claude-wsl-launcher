// server/tabs.js
// 사용자가 만든 작업 탭과 프로젝트 → 탭 배정을 중앙 JSON 에 저장/조회한다. 절대 throw 안 함.
// 형태: { tabs: [{id, name}], assign: { 프로젝트명: 탭id } }. 배정 없는 프로젝트 = '미분류'.
import fs from 'node:fs';
import path from 'node:path';

const EMPTY = () => ({ tabs: [], assign: {} });
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

/** 탭 상태를 검증·정리해 돌려준다. 형식이 틀리면 null. 없는 탭을 가리키는 배정은 버린다. */
export function normalizeTabs(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.tabs)) return null;
  const tabs = [];
  const ids = new Set();
  for (const t of state.tabs) {
    if (!t || !isStr(t.id) || !isStr(t.name) || ids.has(t.id)) return null;
    ids.add(t.id);
    tabs.push({ id: t.id, name: t.name.trim() });
  }
  const assign = {};
  const src = state.assign && typeof state.assign === 'object' && !Array.isArray(state.assign) ? state.assign : {};
  for (const [name, id] of Object.entries(src)) {
    if (isStr(name) && ids.has(id)) assign[name] = id;
  }
  return { tabs, assign };
}

/** 읽기. 파일 없음/깨짐 → 빈 상태. */
export function readTabs(file) {
  try {
    return normalizeTabs(JSON.parse(fs.readFileSync(file, 'utf8'))) || EMPTY();
  } catch {
    return EMPTY();
  }
}

/** 저장. @returns {{ok:true} | {ok:false, error:string}} */
export function writeTabs(file, state) {
  const clean = normalizeTabs(state);
  if (!clean) return { ok: false, error: 'invalid tabs' };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(clean, null, 2) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'write failed' };
  }
}

/** 프로젝트 이름 변경 시 탭 배정을 옮긴다. 배정 없으면 no-op. */
export function renameInTabs(file, oldName, newName) {
  const state = readTabs(file);
  if (!(oldName in state.assign)) return { ok: true };
  state.assign[newName] = state.assign[oldName];
  delete state.assign[oldName];
  return writeTabs(file, state);
}
