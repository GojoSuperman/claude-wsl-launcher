// public/dialog.js
// 브라우저 기본 confirm/alert/prompt 를 대신하는 인앱 모달. Promise 로 결과를 돌려준다.
//   dialogConfirm(msg, {ok, cancel, danger}) → true/false
//   dialogAlert(msg, {ok})                   → undefined
//   dialogPrompt(msg, {value, placeholder, ok, cancel}) → 문자열 | null(취소)
// Enter = 확인, Esc/배경 클릭/✕ = 취소. 여러 줄 메시지는 그대로 줄바꿈된다.
import { t } from './i18n.js';

let root = null;

function ensureRoot() {
  if (root) return root;
  root = document.createElement('div');
  root.id = 'dlg-modal';
  root.className = 'help-modal hidden';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="help-dialog dlg-box">
      <div class="help-head"><h2 id="dlg-title"></h2><button id="dlg-close" class="help-close" type="button" aria-label="close">✕</button></div>
      <p id="dlg-msg" class="dlg-msg"></p>
      <input id="dlg-input" class="dlg-input hidden" type="text" />
      <div class="create-actions dlg-actions">
        <button id="dlg-cancel" type="button" class="ghost"></button>
        <button id="dlg-ok" type="button"></button>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

function open({ title, msg, input, value, placeholder, okLabel, cancelLabel, danger, showCancel }) {
  const el = ensureRoot();
  const $ = (id) => el.querySelector('#' + id);
  $('dlg-title').textContent = title || '';
  $('dlg-msg').textContent = msg || '';
  const inp = $('dlg-input');
  inp.classList.toggle('hidden', !input);
  inp.value = input ? (value || '') : '';
  inp.placeholder = placeholder || '';
  const ok = $('dlg-ok'); const cancel = $('dlg-cancel'); const close = $('dlg-close');
  ok.textContent = okLabel || t('dlgOk');
  cancel.textContent = cancelLabel || t('dlgCancel');
  cancel.classList.toggle('hidden', !showCancel);
  ok.classList.toggle('danger', !!danger);
  const prevFocus = document.activeElement;
  el.classList.remove('hidden');
  (input ? inp : ok).focus();
  if (input) inp.select();

  return new Promise((resolve) => {
    const done = (result) => {
      el.classList.add('hidden');
      ok.onclick = cancel.onclick = close.onclick = el.onclick = null;
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
      else if (e.key === 'Enter' && (input ? e.target === inp : true)) { e.preventDefault(); done(true); }
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    close.onclick = () => done(false);
    el.onclick = (e) => { if (e.target === el) done(false); }; // 배경 클릭
    document.addEventListener('keydown', onKey);
  }).then((yes) => (input ? (yes ? inp.value : null) : yes));
}

export function dialogConfirm(msg, { title, ok, cancel, danger } = {}) {
  return open({ title: title ?? t('dlgConfirmTitle'), msg, okLabel: ok, cancelLabel: cancel, danger, showCancel: true });
}
export function dialogAlert(msg, { title, ok } = {}) {
  return open({ title: title ?? t('dlgAlertTitle'), msg, okLabel: ok, showCancel: false }).then(() => undefined);
}
export function dialogPrompt(msg, { title, value, placeholder, ok, cancel } = {}) {
  return open({ title: title ?? t('dlgPromptTitle'), msg, input: true, value, placeholder, okLabel: ok, cancelLabel: cancel, showCancel: true });
}
