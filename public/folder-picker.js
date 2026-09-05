// public/folder-picker.js
// 프로젝트 폴더 선택창: 추천 후보(클릭) + 폴더 탐색(하위 폴더 클릭·.. 위로) + 경로 직접 입력.
//   pickFolder({ current, home }) → Promise<string|null>  (절대경로 | 취소)
import { t } from './i18n.js';

let root = null;
function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'picker-modal';
  root.className = 'help-modal hidden';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="help-dialog picker-box">
      <div class="help-head"><h2 id="picker-title"></h2><button id="picker-close" class="help-close" type="button" aria-label="close">✕</button></div>
      <div id="picker-cands-wrap"><div class="picker-label" id="picker-cands-label"></div><div id="picker-cands" class="picker-cands"></div></div>
      <div class="picker-label" id="picker-browse-label"></div>
      <input id="picker-path" class="dlg-input picker-path" type="text" spellcheck="false" />
      <ul id="picker-list" class="picker-list"></ul>
      <div id="picker-status" class="picker-status"></div>
      <div class="create-actions dlg-actions">
        <button id="picker-cancel" type="button" class="ghost"></button>
        <button id="picker-ok" type="button"></button>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

const shortPath = (p, home) => (home && p.startsWith(home) ? '~' + p.slice(home.length) : p);

export function pickFolder({ current, home }) {
  const el = ensureRoot();
  const $ = (id) => el.querySelector('#' + id);
  $('picker-title').textContent = t('pickerTitle');
  $('picker-cands-label').textContent = t('pickerCandidates');
  $('picker-browse-label').textContent = t('pickerBrowse');
  $('picker-cancel').textContent = t('dlgCancel');
  $('picker-ok').textContent = t('pickerSelect');
  const input = $('picker-path'); const list = $('picker-list'); const status = $('picker-status'); const cands = $('picker-cands');
  let cur = current || home || '/';

  async function load(p) {
    status.textContent = '';
    list.innerHTML = '';
    let data;
    try { data = await (await fetch(`/api/folders?path=${encodeURIComponent(p)}`)).json(); } catch { data = { ok: false, error: 'connect' }; }
    if (!data.ok) { status.textContent = t('pickerLoadFail', data.error); return; }
    cur = data.path;
    input.value = shortPath(cur, home);
    if (data.parent) {
      const up = document.createElement('li');
      up.className = 'picker-up';
      up.textContent = '.. ' + t('pickerUp');
      up.addEventListener('click', () => load(data.parent));
      list.appendChild(up);
    }
    for (const e of data.entries) {
      const li = document.createElement('li');
      const name = document.createElement('span'); name.className = 'picker-name'; name.textContent = '📁 ' + e.name;
      li.appendChild(name);
      if (e.isRepo) { const b = document.createElement('span'); b.className = 'picker-badge repo'; b.textContent = t('pickerIsRepo'); li.appendChild(b); }
      else if (e.repos > 0) { const b = document.createElement('span'); b.className = 'picker-badge'; b.textContent = t('pickerRepos', e.repos); li.appendChild(b); }
      li.addEventListener('click', () => load(e.path));
      list.appendChild(li);
    }
    if (data.entries.length === 0) status.textContent = t('pickerEmpty');
  }

  async function loadCands() {
    cands.innerHTML = '';
    let data;
    try { data = await (await fetch('/api/folders/candidates')).json(); } catch { data = { ok: false }; }
    const items = data.ok ? data.candidates : [];
    if (items.length === 0) { cands.textContent = t('pickerNoCandidates'); return; }
    for (const c of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'picker-cand';
      b.textContent = `${shortPath(c.path, home)}  (${t('pickerRepos', c.repos)})`;
      b.addEventListener('click', () => load(c.path));
      cands.appendChild(b);
    }
  }

  el.classList.remove('hidden');
  loadCands();
  load(cur);

  return new Promise((resolve) => {
    const done = (v) => {
      el.classList.add('hidden');
      $('picker-ok').onclick = $('picker-cancel').onclick = $('picker-close').onclick = el.onclick = null;
      input.onkeydown = null;
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); load(input.value.trim()); } }; // 직접 입력 → 그 폴더로 이동
    $('picker-ok').onclick = () => done(input.value.trim() || cur);
    $('picker-cancel').onclick = () => done(null);
    $('picker-close').onclick = () => done(null);
    el.onclick = (e) => { if (e.target === el) done(null); };
    document.addEventListener('keydown', onKey);
  });
}
