// public/accounts.js
// 여러 계정: 상태 보관, 실행 버튼 ▾ 메뉴 항목, 계정 추가 흐름, 계정 관리 창.
// 서버 API: /api/accounts (목록), /add, /alias, /remove, /login. 이메일은 서버가 매번 읽어 준다.
import { t } from './i18n.js';
import { dialogConfirm, dialogAlert, dialogPrompt } from './dialog.js';

let accounts = [];
let lastByProject = {};
let onChange = () => {};

const modal = document.getElementById('accounts-modal');
const titleEl = document.getElementById('accounts-title');
const descEl = document.getElementById('accounts-desc');
const listEl = document.getElementById('accounts-list');
const addBtn = document.getElementById('accounts-add');
const closeBtn = document.getElementById('accounts-close');

export function initAccounts(opts) {
  onChange = opts.onChange || onChange;
}

export function setAccounts(list, last) {
  accounts = Array.isArray(list) ? list : [];
  lastByProject = last && typeof last === 'object' ? last : {};
}

export const getAccounts = () => accounts;
const defaultAccount = () => accounts.find((a) => a.isDefault) || { id: 'default', isDefault: true, alias: '', email: '' };

/** 이 프로젝트가 마지막으로 쓴 계정(없거나 목록에서 빠졌으면 기본) */
export function accountFor(projectName) {
  const id = lastByProject[projectName];
  return accounts.find((a) => a.id === id) || defaultAccount();
}

export function rememberLocal(projectName, id) {
  if (id === 'default') delete lastByProject[projectName];
  else lastByProject[projectName] = id;
}

export const shortLabel = (a) => a.alias || a.email || t('accountNeedsLogin');

/** 메뉴용: 별명 · 이메일 / 이메일 / 로그인 필요 · 폴더 (+ 기본 표시) */
export function fullLabel(a) {
  const tag = a.isDefault ? ` (${t('accountDefaultTag')})` : '';
  if (!a.email) return `${a.alias ? `${a.alias} · ` : ''}${t('accountNeedsLogin')} · ${shortDir(a.dir)}${tag}`;
  return `${a.alias ? `${a.alias} · ` : ''}${a.email}${tag}`;
}
const shortDir = (dir) => (dir || '').replace(/^\/home\/[^/]+/, '~');

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

export async function refreshAccounts() {
  try {
    const data = await (await fetch('/api/accounts')).json();
    setAccounts(data.accounts, data.lastByProject);
  } catch { /* 다음 새로고침에서 다시 */ }
  onChange();
  if (!modal.classList.contains('hidden')) renderModal();
}

export async function addAccountFlow() {
  if (!(await dialogConfirm(t('accountAddConfirm')))) return;
  let data;
  try {
    data = await post('/api/accounts/add');
  } catch {
    await dialogAlert(t('accountReqFail'));
    return;
  }
  if (!data.ok) await dialogAlert(t('accountAddFail', data.error));
  else if (data.loginError) await dialogAlert(t('accountAddLoginFail', data.loginError));
  else await dialogAlert(t('accountAddDone'));
  await refreshAccounts();
}

export async function removeAccountFlow(a, { missing = false } = {}) {
  const ask = missing ? t('accountMissingConfirm', a.dir) : t('accountRemoveConfirm', a.dir);
  if (!(await dialogConfirm(ask))) return;
  try {
    await post('/api/accounts/remove', { id: a.id });
  } catch {
    await dialogAlert(t('accountReqFail'));
  }
  await refreshAccounts();
}

async function editAlias(a) {
  const v = await dialogPrompt(t('accountAliasPrompt'), { value: a.alias || '' });
  if (v === null || v === undefined) return;
  try {
    await post('/api/accounts/alias', { id: a.id, alias: v });
  } catch {
    await dialogAlert(t('accountReqFail'));
  }
  await refreshAccounts();
}

async function openLogin(a) {
  try {
    const data = await post('/api/accounts/login', { id: a.id });
    if (data.code === 'account-missing') return removeAccountFlow(a, { missing: true });
    await dialogAlert(data.ok ? t('accountLoginOpened') : t('accountAddLoginFail', data.error));
  } catch {
    await dialogAlert(t('accountReqFail'));
  }
}

function button(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

function renderModal() {
  titleEl.textContent = t('accountsTitle');
  descEl.textContent = t('accountsDesc');
  addBtn.textContent = t('accountAdd');
  closeBtn.title = t('helpClose');
  listEl.innerHTML = '';
  for (const a of accounts) {
    const row = document.createElement('div');
    row.className = 'acct-row';
    row.dataset.id = a.id;
    const main = document.createElement('div');
    main.className = 'acct-main';
    const email = document.createElement('div');
    email.className = 'acct-email';
    email.textContent = (a.alias ? `${a.alias} · ` : '') + (a.email || t('accountNeedsLogin'));
    const meta = document.createElement('div');
    meta.className = 'acct-meta';
    const state = document.createElement('span');
    state.className = 'acct-state ' + (a.loggedIn ? 'ok' : 'need');
    state.textContent = a.loggedIn ? t('accountLoggedIn') : t('accountNeedsLogin');
    meta.append(state, ` · ${shortDir(a.dir)}${a.isDefault ? ` (${t('accountDefaultTag')})` : ''}`);
    main.append(email, meta);
    row.appendChild(main);
    row.appendChild(button(`✎ ${t('accountAliasEdit')}`, () => editAlias(a)));
    if (!a.isDefault) {
      row.appendChild(button(a.loggedIn ? t('accountRelogin') : t('accountLogin'), () => openLogin(a)));
      row.appendChild(button(t('accountRemove'), () => removeAccountFlow(a), 'danger-lite'));
    }
    listEl.appendChild(row);
  }
}

export function openAccountsModal() {
  renderModal();
  modal.classList.remove('hidden');
  closeBtn.focus();
}
function closeModal() {
  modal.classList.add('hidden');
}
closeBtn.addEventListener('click', closeModal);
addBtn.addEventListener('click', addAccountFlow);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });
window.addEventListener('i18n:change', () => { if (!modal.classList.contains('hidden')) renderModal(); });
