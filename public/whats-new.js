// public/whats-new.js
// '✨ 새 기능' 창: 업데이트 뒤 처음 열면 아직 안 본 소식을 자동으로 보여 주고, 헤더 버튼으로 전체 소식을 다시 본다.
// 닫으면(확인·✕·Esc·바깥 클릭) 최신 소식을 본 것으로 서버에 기록 → 다음부터 자동으로 안 뜸.
import { t, getLang } from './i18n.js';
import { RELEASES } from './whats-new-data.js';
import { pickUnseen } from './whats-new-logic.js';

const btn = document.getElementById('whats-new-btn');
const modal = document.getElementById('whats-new-modal');
const body = document.getElementById('whats-new-body');
const okBtn = document.getElementById('whats-new-ok');
const closeBtn = document.getElementById('whats-new-close');
let shown = []; // 지금 창에 그린 소식(언어 전환 때 다시 그림)
let manual = false;
let legacyRoot = null; // 예전에 쓰던 스캔 폴더 — 있으면 맨 위에 '여기서 가져오세요' 안내

const markSeen = () => {
  if (!RELEASES.length) return;
  fetch('/api/whats-new/seen', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: RELEASES[0].id }),
  }).catch(() => { /* 다음에 한 번 더 뜰 뿐 */ });
};

function render() {
  body.innerHTML = '';
  const lang = getLang();
  if (legacyRoot) {
    const note = document.createElement('p'); note.className = 'whats-new-legacy';
    note.textContent = t('whatsNewLegacy', legacyRoot);
    body.appendChild(note);
  }
  shown.forEach((r, i) => {
    if (manual && i === 1) {
      const h = document.createElement('div'); h.className = 'import-section-label'; h.textContent = t('whatsNewAll');
      body.appendChild(h);
    }
    const sec = document.createElement('section'); sec.className = 'whats-new-release';
    const date = document.createElement('div'); date.className = 'whats-new-date'; date.textContent = r.id;
    const ul = document.createElement('ul'); ul.className = 'whats-new-list';
    for (const it of r.items[lang] || r.items.ko) {
      const li = document.createElement('li');
      const b = document.createElement('strong'); b.textContent = it.t;
      const d = document.createElement('p'); d.textContent = it.d;
      li.append(b, d);
      ul.appendChild(li);
    }
    sec.append(date, ul);
    body.appendChild(sec);
  });
}

function open(releases, isManual) {
  shown = releases;
  manual = isManual;
  render();
  modal.classList.remove('hidden');
  okBtn.focus();
}
const isOpen = () => !modal.classList.contains('hidden');
function close() {
  if (!isOpen()) return;
  modal.classList.add('hidden');
  markSeen();
}

btn.addEventListener('click', () => open(RELEASES, true));
okBtn.addEventListener('click', close);
closeBtn.addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
window.addEventListener('i18n:change', () => { if (isOpen()) render(); });

// 시작할 때: 안 본 소식이 있으면 자동으로. 새 사용자(기록·프로젝트·런처 사용 흔적 없음)는 띄우지 않고 본 것으로만 기록.
(async () => {
  let d;
  try { d = await (await fetch('/api/whats-new')).json(); } catch { return; }
  if (!d.ok) return;
  legacyRoot = d.legacyRoot || null;
  const unseen = pickUnseen(RELEASES, d.seen, d.hasProjects);
  if (unseen.length) open(unseen, false);
  else if (!d.seen) markSeen();
})();
