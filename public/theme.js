// public/theme.js
// 라이트/다크/자동(OS 따라감) 전환. color-scheme 만 바꾸면 CSS 의 Canvas/CanvasText 시스템 색이 따라온다.
const LS_KEY = 'launcher.theme';
const VALID = ['system', 'light', 'dark'];

export function getTheme() {
  try {
    const v = localStorage.getItem(LS_KEY);
    return VALID.includes(v) ? v : 'system';
  } catch { return 'system'; }
}

export function applyTheme(theme) {
  const t = VALID.includes(theme) ? theme : 'system';
  // 'system' → 'light dark' (OS 설정 따름), 아니면 고정
  document.documentElement.style.colorScheme = t === 'system' ? 'light dark' : t;
  document.documentElement.dataset.theme = t;
  document.querySelectorAll('#theme-switch button').forEach((b) => b.classList.toggle('active', b.dataset.theme === t));
}

export function setTheme(theme) {
  try { localStorage.setItem(LS_KEY, theme); } catch { /* 저장 불가 환경 */ }
  applyTheme(theme);
}

applyTheme(getTheme());
document.querySelectorAll('#theme-switch button').forEach((b) => {
  b.addEventListener('click', () => setTheme(b.dataset.theme));
});
