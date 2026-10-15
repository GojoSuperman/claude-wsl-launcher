// public/tab-color.js
// 카드의 🎨 탭 색: 자주 쓰는 색 8개 / 직접 고르기 / 색 없음 → 그 프로젝트에서 claude 를 띄울 때 Windows Terminal 탭을 칠한다.
//   pickTabColor(name, current) → Promise<'#rrggbb' | null(색 없음) | undefined(취소)>
import { t } from './i18n.js';

export const PRESETS = [
  ['red', '#e5534b'], ['orange', '#f0883e'], ['yellow', '#d4a72c'], ['green', '#3fa45f'],
  ['teal', '#1abc9c'], ['blue', '#3b82f6'], ['purple', '#8a2be2'], ['pink', '#e05d9e'],
];

let root = null;
function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'help-modal hidden';
  root.id = 'tab-color-modal';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="help-dialog tab-color-box">
      <div class="help-head"><h2 class="tc-title"></h2><button type="button" class="help-close tc-close">✕</button></div>
      <p class="ifp-hint tc-hint"></p>
      <div class="tc-swatches"></div>
      <div class="tc-row">
        <label class="tc-custom"><input type="color" class="tc-input" /> <span class="tc-custom-label"></span></label>
        <button type="button" class="ghost small tc-none"></button>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

export function pickTabColor(name, current) {
  const el = ensureRoot();
  const $ = (c) => el.querySelector('.' + c);
  $('tc-title').textContent = t('tabColorTitle', name);
  $('tc-hint').textContent = t('tabColorHint');
  $('tc-custom-label').textContent = t('tabColorCustom');
  $('tc-none').textContent = t('tabColorNone');
  $('tc-close').setAttribute('aria-label', t('dlgCancel'));
  const input = $('tc-input');
  input.value = current || '#3b82f6';
  const sw = $('tc-swatches');
  sw.innerHTML = '';
  return new Promise((resolve) => {
    const done = (v) => {
      el.classList.add('hidden');
      document.removeEventListener('keydown', onKey);
      el.onclick = null;
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape') done(undefined); };
    for (const [key, hex] of PRESETS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tc-swatch' + (hex === current ? ' selected' : '');
      b.style.background = hex;
      b.title = t(`tabColor_${key}`);
      b.setAttribute('aria-label', t(`tabColor_${key}`));
      b.addEventListener('click', () => done(hex));
      sw.appendChild(b);
    }
    input.onchange = () => done(input.value);
    $('tc-none').onclick = () => done(null);
    $('tc-close').onclick = () => done(undefined);
    el.onclick = (e) => { if (e.target === el) done(undefined); };
    document.addEventListener('keydown', onKey);
    el.classList.remove('hidden');
  });
}
