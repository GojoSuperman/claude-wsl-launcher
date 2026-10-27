// public/accounts.js
// 여러 계정: 상태 보관, 실행 버튼 ▾ 메뉴 항목, 계정 추가 흐름, 계정 관리 창(상단 [👤 계정 관리] 버튼에서 연다).
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
const headerBtn = document.getElementById('accounts-btn');

// 상단 버튼: 두 칸 이상이 같은 곳에 로그인돼 있으면 ⚠ 를 붙여 창을 열지 않아도 보이게
function renderHeaderBtn() {
  const dup = accounts.some((a) => a.dupLogin);
  headerBtn.textContent = `${dup ? '⚠ ' : ''}${t('accountsBtn')}`;
  headerBtn.title = dup ? t('accountDupLogin') : t('accountsTitle');
  headerBtn.classList.toggle('warn', dup);
}

export function initAccounts(opts) {
  onChange = opts.onChange || onChange;
}

export function setAccounts(list, last) {
  accounts = Array.isArray(list) ? list : [];
  lastByProject = last && typeof last === 'object' ? last : {};
  renderHeaderBtn();
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

// 로그인한 조직 + 요금제 종류 — 이메일 하나가 개인·조직(학교·회사)에 함께 속할 때 어느 쪽인지 보이게
export function orgLabel(a) {
  if (!a.org) return '';
  const kind = a.orgType && t(`orgType_${a.orgType}`) !== `orgType_${a.orgType}` ? ` (${t(`orgType_${a.orgType}`)})` : '';
  return `${a.org}${kind}`;
}

/** 메뉴용: 별명 · 이메일 · 조직 / 로그인 필요 · 폴더 (+ 기본 표시, 섞임이면 ⚠) */
export function fullLabel(a) {
  const tag = a.isDefault ? ` (${t('accountDefaultTag')})` : '';
  if (!a.email) return `${a.alias ? `${a.alias} · ` : ''}${t('accountNeedsLogin')} · ${shortDir(a.dir)}${tag}`;
  const org = orgLabel(a);
  return `${a.dupLogin ? '⚠ ' : ''}${a.alias ? `${a.alias} · ` : ''}${a.email}${org ? ` · ${org}` : ''}${tag}`;
}
const shortDir = (dir) => (dir || '').replace(/^\/home\/[^/]+/, '~');

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

// 로그인 창을 연 뒤: 터미널·브라우저에서 로그인이 끝나도 화면은 모른다 → 3초마다(최대 3분) 계정 정보를 다시 읽어,
// 어느 칸이든 로그인 정보(이메일·조직)가 바뀌면 관리 창·상단 버튼·카드 메뉴를 바로 갱신하고 멈춘다.
const loginSig = () => accounts.map((a) => `${a.id}:${a.email}:${a.orgId}`).join('|');
let watchTimer = null;
function watchLogin() {
  clearInterval(watchTimer);
  const before = loginSig();
  const until = Date.now() + 180_000;
  watchTimer = setInterval(async () => {
    await refreshAccounts();
    if (loginSig() !== before || Date.now() > until) { clearInterval(watchTimer); watchTimer = null; }
  }, 3000);
}
// 다른 창(터미널·브라우저)에서 돌아오면 한 번 다시 읽는다
window.addEventListener('focus', () => { refreshAccounts(); });

export async function refreshAccounts() {
  try {
    const data = await (await fetch('/api/accounts')).json();
    setAccounts(data.accounts, data.lastByProject);
  } catch { /* 다음 새로고침에서 다시 */ }
  onChange();
  if (!modal.classList.contains('hidden')) renderModal();
}

// 로그인 전 확인: claude 는 브라우저 claude.ai 에 그때 로그인된 계정·조직으로 연결된다(2026-10-27 실측) →
// 먼저 claude.ai 를 열어 이 칸에 쓸 계정인지 보고 바꾼 뒤 로그인 창을 연다. → Promise<boolean>(계속할지)
let prep = null;
function prepLogin(name) {
  if (!prep) {
    prep = document.createElement('div');
    prep.className = 'help-modal hidden';
    prep.id = 'login-prep';
    prep.setAttribute('role', 'dialog');
    prep.innerHTML = `<div class="help-dialog login-prep-box"><h2></h2><ol class="login-prep-steps"><li class="s1"></li><li class="s2"></li></ol>
      <p class="ifp-hint lp-note"></p>
      <div class="dlg-actions"><button type="button" class="ghost lp-cancel"></button><button type="button" class="ghost lp-open"></button><button type="button" class="lp-go"></button></div></div>`;
    document.body.appendChild(prep);
  }
  const $ = (c) => prep.querySelector('.' + c);
  $('login-prep-box').querySelector('h2').textContent = t('loginPrepTitle', name);
  $('s1').textContent = t('loginPrepStep1');
  $('s2').textContent = t('loginPrepStep2');
  $('lp-note').textContent = t('loginPrepNote');
  $('lp-cancel').textContent = t('dlgCancel');
  $('lp-open').textContent = t('loginPrepOpen');
  $('lp-go').textContent = t('loginPrepGo');
  return new Promise((resolve) => {
    const done = (v) => { prep.classList.add('hidden'); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    $('lp-open').onclick = () => window.open('https://claude.ai/', '_blank', 'noopener');
    $('lp-go').onclick = () => done(true);
    $('lp-cancel').onclick = () => done(false);
    document.addEventListener('keydown', onKey);
    prep.classList.remove('hidden');
  });
}

export async function addAccountFlow() {
  if (!(await dialogConfirm(t('accountAddConfirm')))) return;
  if (!(await prepLogin(t('accountNew')))) return;
  let data;
  try {
    data = await post('/api/accounts/add');
  } catch {
    await dialogAlert(t('accountReqFail'));
    return;
  }
  if (!data.ok) await dialogAlert(t('accountAddFail', data.error));
  else if (data.loginError) await dialogAlert(t('accountAddLoginFail', data.loginError));
  else { watchLogin(); await dialogAlert(t('accountAddDone')); }
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
  if (!(await prepLogin(a.alias || a.email || t('accountNeedsLogin')))) return;
  try {
    const data = await post('/api/accounts/login', { id: a.id });
    if (data.code === 'account-missing') return removeAccountFlow(a, { missing: true });
    if (data.ok) watchLogin();
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
    main.append(email);
    if (a.loggedIn && a.org) {
      const org = document.createElement('div');
      org.className = 'acct-org';
      org.textContent = t('accountOrg', orgLabel(a));
      main.appendChild(org);
    }
    main.appendChild(meta);
    if (a.dupLogin) {
      // 나눠 둔 계정 칸이 실제로는 같은 곳에 로그인 — 어느 칸으로 열어도 같은 계정·사용량
      const warn = document.createElement('div');
      warn.className = 'acct-dup';
      warn.textContent = t('accountDupLogin');
      main.appendChild(warn);
    }
    row.appendChild(main);
    row.appendChild(button(`✎ ${t('accountAliasEdit')}`, () => editAlias(a)));
    // 다시 로그인은 기본 칸도 — 잘못된 계정·조직으로 로그인된 개인 칸을 화면에서 바로잡게. 목록에서 빼기는 추가 계정만.
    row.appendChild(button(a.loggedIn ? t('accountRelogin') : t('accountLogin'), () => openLogin(a)));
    if (!a.isDefault) row.appendChild(button(t('accountRemove'), () => removeAccountFlow(a), 'danger-lite'));
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
headerBtn.addEventListener('click', () => refreshAccounts().then(openAccountsModal)); // 다시 로그인 뒤에도 최신 상태로
renderHeaderBtn();
addBtn.addEventListener('click', addAccountFlow);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });
window.addEventListener('i18n:change', () => { renderHeaderBtn(); if (!modal.classList.contains('hidden')) renderModal(); });
