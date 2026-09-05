// public/app.js
import { t, getLang, setLang } from './i18n.js';

const grid = document.getElementById('grid');
const banner = document.getElementById('banner');
const refreshBtn = document.getElementById('refresh');
const newProjectBtn = document.getElementById('new-project');
const langSwitch = document.getElementById('lang-switch');

function showBanner(msg) {
  banner.textContent = msg;
  banner.classList.remove('hidden');
}
function hideBanner() {
  banner.classList.add('hidden');
}

// 정적 텍스트(헤더·data-i18n 요소)·문서 제목·언어 버튼 상태를 현재 언어로 갱신.
function applyStaticI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  langSwitch.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
}

async function loadProjects() {
  hideBanner();
  grid.innerHTML = '';
  let data;
  try {
    const res = await fetch('/api/projects');
    data = await res.json();
    if (!res.ok) {
      showBanner(t('projectsError', data.error ?? res.status));
      return;
    }
  } catch {
    showBanner(t('connectFail'));
    return;
  }
  for (const p of data.projects) {
    grid.appendChild(renderCard(p));
  }
  if (data.projects.length === 0) {
    showBanner(t('noProjects'));
  }
}

function relativeTime(iso) {
  if (!iso) return t('noCommit');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return t('noCommit');
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return t('justNow');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('minAgo', min);
  const hour = Math.floor(min / 60);
  if (hour < 24) return t('hourAgo', hour);
  const day = Math.floor(hour / 24);
  if (day <= 30) return t('dayAgo', day);
  return iso.slice(0, 10); // YYYY-MM-DD
}

function renderCard(p) {
  const card = document.createElement('div');
  card.className = 'card';

  const name = document.createElement('div');
  name.className = 'name';
  const nameText = document.createElement('span');
  nameText.className = 'name-text';
  nameText.textContent = p.name;
  name.appendChild(nameText);
  if (p.running) {
    const badge = document.createElement('span');
    badge.className = 'badge-running';
    badge.textContent = t('running');
    name.appendChild(badge);
    card.classList.add('is-running');
  }

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = p.hasSession ? t('hasSession') : t('newSession');

  const actions = document.createElement('div');
  actions.className = 'actions';

  const launchBtn = document.createElement('button');
  launchBtn.type = 'button';
  launchBtn.textContent = p.hasSession ? t('launchContinue') : t('launchNew');
  launchBtn.addEventListener('click', () => doLaunch(p.name, launchBtn, card));

  actions.appendChild(launchBtn);

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'ghost';
  renameBtn.textContent = t('rename');
  renameBtn.title = t('renameTitle');
  renameBtn.addEventListener('click', () => doRename(p.name, renameBtn));
  if (p.running || p.self) {
    // 실행 중이거나 이 대시보드 서버 자신의 폴더 — 옮기면 세션/서버가 깨지므로 미리 막는다
    renameBtn.disabled = true;
    renameBtn.title = p.self ? t('renameSelfBlocked') : t('renameRunningBlocked');
  }
  actions.appendChild(renameBtn);

  if (p.git && p.git.isGit && p.git.hasUpstream) {
    const remote = document.createElement('span');
    remote.className = 'remote';
    const fetchBtn = document.createElement('button');
    fetchBtn.type = 'button';
    fetchBtn.textContent = t('checkRemote');
    fetchBtn.addEventListener('click', () => doFetch(p.name, fetchBtn, remote));
    actions.append(fetchBtn, remote);
  }

  const g = p.git;
  if (g) {
    const gitMeta = document.createElement('div');
    gitMeta.className = 'git-meta';
    if (!g.isGit) {
      gitMeta.textContent = t('notGit');
    } else {
      gitMeta.textContent = `${g.branch ?? 'HEAD'} · `;
      const dirtySpan = document.createElement('span');
      dirtySpan.textContent = g.dirty ? t('dirty') : t('clean');
      if (g.dirty) dirtySpan.className = 'git-dirty';
      gitMeta.append(dirtySpan, document.createTextNode(` · ${relativeTime(g.lastCommitISO)}`));
    }
    card.append(name, meta, gitMeta, actions);
  } else {
    // git 필드 없음(구버전 호환) → git 줄 생략
    card.append(name, meta, actions);
  }
  return card;
}

async function doLaunch(name, btn, card) {
  hideBanner();
  btn.disabled = true;
  const original = btn.textContent;
  try {
    const res = await fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      const toast = document.createElement('span');
      toast.className = 'toast';
      toast.textContent = t('launchToast');
      card.querySelector('.actions').appendChild(toast);
      setTimeout(() => toast.remove(), 2500);
    } else {
      showBanner(t('launchFail', data.error));
    }
  } catch {
    showBanner(t('launchReqFail'));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function doFetch(name, btn, remoteEl) {
  hideBanner();
  btn.disabled = true;
  try {
    const res = await fetch('/api/git/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!data.ok) {
      showBanner(t('fetchFail', data.error ?? t('serverError')));
      return;
    }
    renderRemote(remoteEl, name, data.ahead, data.behind);
  } catch {
    showBanner(t('fetchReqFail'));
  } finally {
    btn.disabled = false;
  }
}

function renderRemote(remoteEl, name, ahead, behind) {
  remoteEl.textContent = '';
  if (behind > 0) {
    const b = document.createElement('span');
    b.className = 'remote-behind';
    b.textContent = t('behind', behind);
    const pullBtn = document.createElement('button');
    pullBtn.type = 'button';
    pullBtn.textContent = t('pull');
    pullBtn.addEventListener('click', () => doPull(name, pullBtn));
    remoteEl.append(b, document.createTextNode(' '), pullBtn);
  } else {
    remoteEl.append(document.createTextNode(ahead > 0 ? t('ahead', ahead) : t('upToDate')));
  }
}

async function doPull(name, btn) {
  if (!window.confirm(t('pullConfirm', name))) return;
  hideBanner();
  btn.disabled = true;
  try {
    const res = await fetch('/api/git/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      loadProjects();
    } else {
      showBanner(t('pullFail', data.error ?? t('mergeNeeded')));
      btn.disabled = false;
    }
  } catch {
    showBanner(t('pullReqFail'));
    btn.disabled = false;
  }
}

async function doCreate() {
  const raw = window.prompt(t('createPrompt'));
  if (raw === null) return;
  const name = raw.trim();
  if (!name) return;
  hideBanner();
  newProjectBtn.disabled = true;
  try {
    const res = await fetch('/api/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.ok) {
      loadProjects();
    } else {
      showBanner(t('createFail', data.error ?? t('unknownError')));
    }
  } catch {
    showBanner(t('createReqFail'));
  } finally {
    newProjectBtn.disabled = false;
  }
}

async function doRename(name, btn) {
  const raw = window.prompt(t('renamePrompt', name), name);
  if (raw === null) return;
  const newName = raw.trim();
  if (!newName || newName === name) return;
  hideBanner();
  btn.disabled = true;
  try {
    const res = await fetch('/api/projects/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, newName }),
    });
    const data = await res.json();
    if (data.ok) {
      await loadProjects();
      if (data.warning) showBanner(t('renameWarn', data.warning));
    } else {
      showBanner(t('renameFail', data.error ?? t('unknownError')));
    }
  } catch {
    showBanner(t('renameReqFail'));
  } finally {
    btn.disabled = false;
  }
}

newProjectBtn.addEventListener('click', doCreate);
refreshBtn.addEventListener('click', loadProjects);

const shutdownBtn = document.getElementById('shutdown');
shutdownBtn.addEventListener('click', async () => {
  if (!window.confirm(t('shutdownConfirm'))) return;
  try {
    await fetch('/api/shutdown', { method: 'POST' });
  } catch { /* 종료 중 연결 끊김은 정상 */ }
  showBanner(t('shutdownDone'));
});

// 언어 전환: 버튼 클릭 → setLang(이벤트 발화) → i18n:change 에서 재렌더
langSwitch.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => setLang(b.dataset.lang));
});
window.addEventListener('i18n:change', () => {
  applyStaticI18n();
  loadProjects();
});

applyStaticI18n();
loadProjects();
