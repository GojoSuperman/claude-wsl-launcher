// public/trash-modal.js
// 휴지통: 카드 삭제로 WSL 휴지통에 간 프로젝트 목록 → [되살리기] / [영구 삭제] / [모두 비우기]. 작업 폴더 줄의 '🗑 휴지통 (n)' 버튼으로 연다(비면 숨김).
//   initTrash({ relativeTime, onRestored }) → { refresh() }   refresh = 버튼 개수 갱신(카드 목록을 다시 읽을 때마다)
import { t } from './i18n.js';
import { dialogAlert, dialogConfirm, dialogPrompt } from './dialog.js';

export function initTrash({ relativeTime, onRestored }) {
  const btn = document.getElementById('trash-btn');
  const modal = document.getElementById('trash-modal');
  const list = document.getElementById('trash-list');
  const status = document.getElementById('trash-status');
  const emptyBtn = document.getElementById('trash-empty');
  let items = [];

  const setStatus = (msg) => { status.textContent = msg || ''; status.classList.toggle('hidden', !msg); };
  const errText = (e) => (t(`trashErr_${e}`) === `trashErr_${e}` ? e : t(`trashErr_${e}`));

  async function fetchItems() {
    try {
      const d = await (await fetch('/api/trash')).json();
      items = d.ok ? d.items : [];
    } catch { items = []; }
    btn.textContent = t('trashBtn', items.length);
    btn.classList.toggle('hidden', items.length === 0);
  }

  function render() {
    list.innerHTML = '';
    setStatus(items.length ? '' : t('trashEmpty'));
    emptyBtn.classList.toggle('hidden', items.length === 0);
    for (const it of items) {
      const li = document.createElement('li');
      const name = document.createElement('span'); name.className = 'repo-name'; name.textContent = it.name;
      const when = document.createElement('span'); when.className = 'repo-when'; when.textContent = t('trashDeletedAt', relativeTime(it.deletedAt));
      const b = document.createElement('button'); b.type = 'button'; b.className = 'small'; b.textContent = t('trashRestore');
      b.addEventListener('click', () => restore(it, b));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'small ghost trash-danger'; del.textContent = t('trashPurge');
      del.addEventListener('click', () => purge([it]));
      li.append(name, when, b, del);
      list.appendChild(li);
    }
  }

  async function restore(it, b) {
    let name;
    if (it.taken) {
      name = ((await dialogPrompt(t('trashNameTaken', it.name), { value: `${it.name}-2` })) || '').trim();
      if (!name) return;
    }
    b.disabled = true;
    let r;
    try {
      r = await (await fetch('/api/trash/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, name }),
      })).json();
    } catch { r = { ok: false, error: t('cloneReqFail') }; }
    if (!r.ok) { b.disabled = false; await dialogAlert(t('trashRestoreFail', errText(r.error))); return; }
    await fetchItems();
    render();
    await onRestored(r.name);
  }

  // 영구 삭제(되돌릴 수 없음) — 한 번 더 묻는다
  async function purge(targets) {
    const msg = targets.length === 1 ? t('trashPurgeConfirm', targets[0].name) : t('trashEmptyConfirm', targets.length);
    if (!(await dialogConfirm(msg, { ok: t('trashPurge'), danger: true }))) return;
    const failed = [];
    for (const it of targets) {
      let r;
      try {
        r = await (await fetch('/api/trash/purge', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id }),
        })).json();
      } catch { r = { ok: false, error: t('cloneReqFail') }; }
      if (!r.ok) failed.push(`${it.name} (${errText(r.error)})`);
    }
    await fetchItems();
    render();
    if (failed.length) await dialogAlert(t('trashPurgeFail', failed.join('\n')));
  }
  emptyBtn.addEventListener('click', () => purge(items));

  const close = () => modal.classList.add('hidden');
  btn.addEventListener('click', async () => {
    modal.classList.remove('hidden');
    setStatus(t('importLoading'));
    list.innerHTML = '';
    await fetchItems();
    render();
  });
  document.getElementById('trash-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  window.addEventListener('i18n:change', () => { btn.textContent = t('trashBtn', items.length); if (!modal.classList.contains('hidden')) render(); });

  return { refresh: fetchItems };
}
