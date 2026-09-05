// public/help.js
// 헤더 [❓ 도움말] 버튼 / `?` 키 → 사용법 모달. 내용은 i18n 으로 채우고 언어 전환에 반응한다.
import { t, getLang } from './i18n.js';

const REPO = 'https://github.com/GojoSuperman/claude-wsl-launcher';
const GUIDE_PATH = { ko: 'docs/SETUP.ko.md', en: 'docs/SETUP.en.md', ja: 'docs/SETUP.ja.md' };
const ITEM_KEYS = ['helpLaunch', 'helpRemote', 'helpNewProject', 'helpRename', 'helpConsole', 'helpShutdown', 'helpLang'];

const btn = document.getElementById('help-btn');
const modal = document.getElementById('help-modal');
const titleEl = document.getElementById('help-title');
const listEl = document.getElementById('help-list');
const guideEl = document.getElementById('help-guide');
const closeBtn = document.getElementById('help-close');

function render() {
  titleEl.textContent = t('helpTitle');
  closeBtn.title = t('helpClose');
  closeBtn.setAttribute('aria-label', t('helpClose'));
  listEl.innerHTML = '';
  for (const k of ITEM_KEYS) {
    const li = document.createElement('li');
    li.textContent = t(k);
    listEl.appendChild(li);
  }
  const lang = getLang();
  guideEl.textContent = t('helpFullGuide');
  guideEl.href = `${REPO}/blob/main/${GUIDE_PATH[lang] || GUIDE_PATH.ko}`;
}

const isOpen = () => !modal.classList.contains('hidden');
function open() {
  render();
  modal.classList.remove('hidden');
  closeBtn.focus();
}
function close() {
  modal.classList.add('hidden');
  btn.focus();
}

btn.addEventListener('click', open);
closeBtn.addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); }); // backdrop 클릭

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen()) {
    close();
  } else if (e.key === '?' && !isOpen()) {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return; // 입력 중이면 무시
    e.preventDefault();
    open();
  }
});

// 언어 전환 시 열려 있으면 즉시 내용 갱신
window.addEventListener('i18n:change', () => { if (isOpen()) render(); });
