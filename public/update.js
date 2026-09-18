// public/update.js
// 헤더 [⟳ 업데이트] → 이 도구 자신을 최신으로. help.js 와 같은 모달 패턴을 재사용한다.
//
// 이 화면이 존재하는 이유: 터미널을 안 쓰는 사용자가 업데이트할 길이 없었고, 더 나쁜 건
// git pull 만 하고 서버를 안 껐을 때 화면은 새 코드·서버는 옛 코드가 되어 새 기능이
// '서버 오류'로 보이는 것이었다. 여기서는 업데이트 성공 뒤 '종료' 를 같은 흐름에 붙여
// 그 상태가 생기지 않게 한다.
import { t } from './i18n.js';

const btn = document.getElementById('update-btn');
const modal = document.getElementById('update-modal');
const titleEl = document.getElementById('update-title');
const statusEl = document.getElementById('update-status');
const errorEl = document.getElementById('update-error');
const closeBtn = document.getElementById('update-close');
const cancelBtn = document.getElementById('update-cancel');
const submitBtn = document.getElementById('update-submit');

const isOpen = () => !modal.classList.contains('hidden');

function setError(msg) {
  errorEl.textContent = msg || '';
  errorEl.classList.toggle('hidden', !msg);
}

/** 서버가 준 code 를 번역된 문구로. 모르면 원문(영어라도 숨기는 것보다 낫다). */
function explain(code, raw) {
  switch (code) {
    case 'local-changes': return t('updateLocalChanges');
    case 'diverged': return t('updateDiverged');
    case 'network': return t('updateNetwork');
    default: return raw || t('updateFailed');
  }
}

/** 버튼 두 개의 라벨·동작을 한 번에 정한다. onSubmit 이 없으면 주 버튼을 숨긴다. */
function setActions(cancelLabel, submitLabel, onSubmit) {
  cancelBtn.textContent = cancelLabel;
  submitBtn.textContent = submitLabel || '';
  submitBtn.classList.toggle('hidden', !onSubmit);
  submitBtn.disabled = false;
  submitBtn.onclick = onSubmit || null;
}

async function checkForUpdate() {
  statusEl.textContent = t('updateChecking');
  setError('');
  setActions(t('updateClose'), '', null);
  try {
    const res = await fetch('/api/update/check');
    const data = await res.json();
    if (!isOpen()) return;
    if (!data.ok) {
      statusEl.textContent = t('updateCheckFailed');
      setError(explain(data.code, data.error));
      return;
    }
    if (!data.available) {
      statusEl.textContent = t('updateUpToDate');
      return;
    }
    statusEl.textContent = t('updateAvailable', data.behind);
    setActions(t('updateCancel'), t('updateNow'), doUpdate);
  } catch {
    if (isOpen()) { statusEl.textContent = t('updateCheckFailed'); setError(t('updateReqFail')); }
  }
}

async function doUpdate() {
  statusEl.textContent = t('updateRunning');
  setError('');
  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/update', { method: 'POST' });
    const data = await res.json();
    if (!isOpen()) return;
    if (!data.ok) {
      statusEl.textContent = data.step === 'npm' ? t('updateNpmFailed') : t('updateFailed');
      setError(explain(data.code, data.error));
      setActions(t('updateClose'), '', null);
      return;
    }
    if (!data.changed) { statusEl.textContent = t('updateUpToDate'); setActions(t('updateClose'), '', null); return; }
    // 여기서 끝내면 '화면은 새 코드, 서버는 옛 코드' 상태가 된다 → 종료를 같은 흐름에 붙인다
    statusEl.textContent = t('updateDoneRestart');
    setActions(t('updateLater'), t('updateShutdownNow'), doShutdown);
  } catch {
    if (isOpen()) { statusEl.textContent = t('updateFailed'); setError(t('updateReqFail')); }
  }
}

async function doShutdown() {
  submitBtn.disabled = true;
  try { await fetch('/api/shutdown', { method: 'POST' }); } catch { /* 종료 중 끊김은 정상 */ }
  statusEl.textContent = t('updateShutdownDone');
  setActions(t('updateClose'), '', null);
}

function open() {
  titleEl.textContent = t('updateTitle');
  closeBtn.title = t('updateClose');
  closeBtn.setAttribute('aria-label', t('updateClose'));
  modal.classList.remove('hidden');
  closeBtn.focus();
  checkForUpdate();
}
function close() {
  modal.classList.add('hidden');
  btn.focus();
}

btn.addEventListener('click', open);
closeBtn.addEventListener('click', close);
cancelBtn.addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); }); // backdrop
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
