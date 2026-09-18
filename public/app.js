// public/app.js
import { t, getLang, setLang } from './i18n.js';
import { dialogConfirm, dialogAlert, dialogPrompt } from './dialog.js';
import { pickFolder } from './folder-picker.js';
import { classify } from './sync-classify.js';
import { computeCardStatus } from './card-status.js';
import { groupProjects } from './project-group.js';

const grid = document.getElementById('grid');
const banner = document.getElementById('banner');
const refreshBtn = document.getElementById('refresh');
const newProjectBtn = document.getElementById('new-project');
const cloneProjectBtn = document.getElementById('clone-project');
const importModal = document.getElementById('import-modal');
const importTitle = document.getElementById('import-title');
const importClose = document.getElementById('import-close');
const importSearch = document.getElementById('import-search');
const importStatus = document.getElementById('import-status');
const importList = document.getElementById('import-list');
const langSwitch = document.getElementById('lang-switch');
const createModal = document.getElementById('create-modal');
const createTitle = document.getElementById('create-title');
const createClose = document.getElementById('create-close');
const createInput = document.getElementById('create-input');
const createError = document.getElementById('create-error');
const createSubmit = document.getElementById('create-submit');
const createCancel = document.getElementById('create-cancel');
// 검사(원격 확인) 완료 → 실행 잠금 해제된 프로젝트명.
// 페이지 메모리 상태 → 서버 재실행 후 페이지를 새로 열면 자동 초기화. "새로고침" 버튼은 유지(목록만 다시 읽음).
const checked = new Set();
// 프로젝트명 → {ahead, behind, state}. 재렌더(언어 전환) 시 배지 복원.
const syncCache = new Map();
// 프로젝트명 → 서버 프로젝트 객체(p). renderStatus 가 git 정보를 참조.
const projects = new Map();

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

// ---- 스캔 폴더 (설정 파일) ----
let rootInfo = { projectsRoot: '', source: 'default', home: '' };
const rootPathEl = document.getElementById('root-path');
const rootChangeBtn = document.getElementById('root-change');

function shortPath(p) {
  return rootInfo.home && p.startsWith(rootInfo.home) ? '~' + p.slice(rootInfo.home.length) : p;
}

async function loadRoot() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.ok) rootInfo = data;
  } catch { /* 표시만 못 할 뿐 */ }
  rootPathEl.textContent = shortPath(rootInfo.projectsRoot || '');
  rootChangeBtn.disabled = rootInfo.source === 'env';
  rootChangeBtn.title = rootInfo.source === 'env' ? t('rootLockedEnv') : t('rootChangeTitle');
}

async function changeRoot() {
  const raw = await pickFolder({ current: rootInfo.projectsRoot || '', home: rootInfo.home });
  if (raw === null || !raw.trim()) return;
  hideBanner();
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectsRoot: raw.trim() }),
    });
    const data = await res.json();
    if (!data.ok) {
      await dialogAlert(t('rootFail', t(`rootErr_${data.error}`) === `rootErr_${data.error}` ? data.error : t(`rootErr_${data.error}`)));
      return;
    }
    if (data.warning === 'windows-fs') await dialogAlert(t('rootWarnWindowsFs'));
    await loadRoot();
    await loadProjects();
  } catch {
    showBanner(t('connectFail'));
  }
}
rootChangeBtn.addEventListener('click', changeRoot);

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
  projects.clear();
  for (const p of data.projects) projects.set(p.name, p); // 상태 조회용 — 렌더 전에 먼저 채움
  // GitHub 연결 여부로 두 그룹(각 이름순) → 섹션 헤더 + 카드
  const { noGithub, github } = groupProjects(data.projects);
  fillVisibility(data.projects.filter((p) => p.github).map((p) => p.name));
  renderGroup(t('groupNoGithub'), noGithub);
  renderGroup(t('groupGithub'), github);
  if (data.projects.length === 0) {
    // 빈 목록 = 스캔 폴더가 잘못 잡혔을 가능성이 가장 큼 → 바로 바꿀 수 있게
    showBanner(t('noProjects', shortPath(rootInfo.projectsRoot)));
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'small'; b.textContent = t('rootChange');
    b.addEventListener('click', changeRoot);
    banner.appendChild(b);
  }
}

// 그룹이 비어있지 않으면 섹션 헤더(전체폭) + 그 그룹 카드들을 grid 에 추가
function renderGroup(label, group) {
  if (!group.length) return;
  const header = document.createElement('div');
  header.className = 'grid-section';
  header.textContent = label;
  grid.appendChild(header);
  for (const p of group) grid.appendChild(renderCard(p));
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

// 카드 아이콘(인라인 SVG — 폰트 글리프에 의존하지 않아 어디서나 또렷)
const ICON_PENCIL = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M11.7 1.6a1.4 1.4 0 0 1 2 2l-.8.8-2-2 .8-.8zM10 3.3l2 2-6.6 6.6-2.6.6.6-2.6L10 3.3z"/></svg>';
const ICON_RENAME = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M1 4.5A1.5 1.5 0 0 1 2.5 3h5.6l1.5 1.5H13.5A1.5 1.5 0 0 1 15 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 11.5v-7zM2.5 4.5v7h11V6H9l-1.5-1.5H2.5zM5 7h6v1.2H5V7zm0 2.3h4v1.2H5V9.3z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M6.5 1.5h3l.5 1H13V4H3V2.5h2.5l1-1zM4 5h8l-.6 8.2a1.2 1.2 0 0 1-1.2 1.1H5.8a1.2 1.2 0 0 1-1.2-1.1L4 5z"/></svg>';

// SVG 아이콘 + 라벨 버튼. svg 는 정적 마크업, label 은 textContent 로 안전 삽입.
function iconButton(className, svg, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.innerHTML = svg;
  b.title = label;
  b.setAttribute('aria-label', label);
  const span = document.createElement('span');
  span.textContent = label;
  b.appendChild(span);
  b.addEventListener('click', onClick);
  return b;
}

// GitHub 공개/비공개 배지를 비동기로 채운다 (gh 미설치/미로그인 → '?' 표시)
async function fillVisibility(names) {
  if (names.length === 0) return;
  let data;
  try {
    const res = await fetch('/api/github/visibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });
    data = await res.json();
  } catch { data = null; }
  for (const name of names) {
    const badge = grid.querySelector(`.gh-badge[data-name="${CSS.escape(name)}"]`);
    if (!badge) continue;
    const v = data?.visibility?.[name] ?? null;
    badge.classList.remove('public', 'private');
    badge.dataset.visibility = v || '';
    if (v === 'PUBLIC') { badge.textContent = t('ghPublic'); badge.classList.add('public'); badge.title = t('ghPublicTitle') + ' — ' + t('ghToggleHint'); }
    else if (v === 'PRIVATE' || v === 'INTERNAL') { badge.textContent = t('ghPrivate'); badge.classList.add('private'); badge.title = t('ghPrivateTitle') + ' — ' + t('ghToggleHint'); }
    else { badge.textContent = '?'; badge.title = t('ghVisibilityUnknown'); }
  }
}

// 배지 클릭 → 공개↔비공개 전환 (확인창 후 gh repo edit). 위임 리스너 하나로 처리.
grid.addEventListener('click', async (e) => {
  const badge = e.target.closest('.gh-badge');
  if (!badge) return;
  const cur = badge.dataset.visibility;
  if (cur !== 'PUBLIC' && cur !== 'PRIVATE') return; // 미확인(?)은 전환 불가
  const name = badge.dataset.name;
  const next = cur === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
  if (!(await dialogConfirm(t(next === 'PUBLIC' ? 'ghMakePublicConfirm' : 'ghMakePrivateConfirm', name), { danger: next === 'PUBLIC' }))) return;
  hideBanner();
  badge.textContent = '…';
  try {
    const res = await fetch('/api/github/visibility/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, visibility: next }),
    });
    const data = await res.json();
    if (!data.ok) showBanner(t('ghToggleFail', data.error ?? t('unknownError')));
  } catch {
    showBanner(t('ghToggleFail', t('unknownError')));
  }
  fillVisibility([name]);
});

function renderCard(p) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.name = p.name;

  // 상단 색 띠 (renderStatus 가 채움)
  const strip = document.createElement('div');
  strip.className = 'card-strip';
  strip.hidden = true;

  // 이름 (+ 실행 중 배지)
  const name = document.createElement('div');
  name.className = 'name';
  const nameText = document.createElement('span');
  nameText.className = 'name-text';
  nameText.textContent = p.name;
  name.appendChild(nameText);
  if (p.running) {
    const rb = document.createElement('span');
    rb.className = 'badge-running';
    rb.textContent = t('running');
    name.appendChild(rb);
    card.classList.add('is-running');
  }
  // 한글 메모 부제 (있을 때만)
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = p.note || '';
  note.hidden = !p.note;

  // 로컬(내 PC) 행 — 라벨 없이 git 요약만
  const g = p.git;
  const local = document.createElement('div');
  local.className = 'local-row';
  let dirty = false;
  if (!g || !g.isGit) {
    local.textContent = t('notGit');
  } else {
    dirty = !!g.dirty;
    const dirtyTxt = dirty ? t('dirty') : t('clean');
    local.textContent = `${g.branch ?? 'HEAD'} · ${dirtyTxt} · ${relativeTime(g.lastCommitISO)}`;
  }

  // (미커밋일 때만) 설명 한 줄
  const hint = document.createElement('div');
  hint.className = 'uncommitted-hint';
  hint.textContent = t('uncommittedHint');
  hint.hidden = !dirty;

  // GitHub 행 (renderStatus 가 값/표시 채움)
  const github = document.createElement('div');
  github.className = 'github-row';
  const ghLab = document.createElement('span');
  ghLab.className = 'lab';
  ghLab.textContent = t('githubLabel');
  const ghVal = document.createElement('span');
  ghVal.className = 'gh-val';
  github.append(ghLab, ghVal);
  if (p.github) {
    // 공개/비공개 배지 (gh 로 비동기 조회 → fillVisibility 가 채움)
    const badge = document.createElement('span');
    badge.className = 'gh-badge';
    badge.dataset.name = p.name;
    badge.textContent = '…';
    badge.title = t('ghVisibilityLoading');
    github.appendChild(badge);
  }

  // 주 액션: 실행 + 동적 슬롯(GitHub 확인/받기)
  const actions = document.createElement('div');
  actions.className = 'actions';
  const launchBtn = document.createElement('button');
  launchBtn.type = 'button';
  launchBtn.className = 'launch';
  launchBtn.textContent = p.hasSession ? t('launchContinue') : t('launchNew');
  launchBtn.addEventListener('click', () => doLaunch(p.name, launchBtn, card));
  const syncSlot = document.createElement('span');
  syncSlot.className = 'sync-actions';
  actions.append(launchBtn, syncSlot);

  // 보조 액션: 메모 / 삭제 (SVG 아이콘 + 한글 라벨)
  const actionsSecondary = document.createElement('div');
  actionsSecondary.className = 'actions-secondary';
  const noteBtn = iconButton('card-note', ICON_PENCIL, t('noteBtn'), () => openNoteModal(p.name));
  const delBtn = iconButton('card-delete', ICON_TRASH, t('deleteTitle'), () => openDeleteModal(p.name));
  const renameBtn = iconButton('card-rename', ICON_RENAME, t('renameBtn'), () => doRename(p.name, renameBtn));
  if (p.running || p.self) {
    // 실행 중이거나 이 대시보드 서버 자신의 폴더 — 옮기면 세션/서버가 깨지므로 미리 막는다
    renameBtn.disabled = true;
    renameBtn.title = p.self ? t('renameSelfBlocked') : t('renameRunningBlocked');
  }
  actionsSecondary.append(noteBtn, renameBtn, delBtn);

  card.append(strip, name, note, local, hint, github, actions, actionsSecondary);
  renderStatus(card);
  return card;
}

// 카드의 동적 상태(띠·GitHub행·잠금·확인/받기 버튼)를 현재 checked/syncCache 기준으로 그린다.
function renderStatus(card) {
  if (!card) return;
  const p = projects.get(card.dataset.name);
  if (!p) return;
  const g = p.git || {};
  const st = computeCardStatus({
    isGit: !!g.isGit,
    hasUpstream: !!g.hasUpstream,
    checked: checked.has(p.name),
    sync: syncCache.get(p.name),
  });

  // 색 띠
  const strip = card.querySelector('.card-strip');
  strip.className = 'card-strip';
  if (st.stripKey) {
    strip.textContent = st.stripArg !== undefined ? t(st.stripKey, st.stripArg) : t(st.stripKey);
    strip.classList.add('strip-' + st.level);
    strip.hidden = false;
  } else {
    strip.textContent = '';
    strip.hidden = true;
  }

  // ☁️ GitHub 행
  const github = card.querySelector('.github-row');
  const ghVal = card.querySelector('.gh-val');
  if (st.githubKey) {
    github.hidden = false;
    ghVal.textContent = t(st.githubKey, ...st.githubArgs);
    const cls = { behind: 'gh-behind', ahead: 'gh-ahead', diverged: 'gh-diverged', upToDate: 'gh-synced' }[st.githubKey] || '';
    ghVal.className = 'gh-val' + (cls ? ' ' + cls : '');
  } else {
    github.hidden = true;
  }

  // 실행 잠금
  const lb = card.querySelector('button.launch');
  if (lb) {
    lb.disabled = st.locked;
    if (st.locked) lb.title = t('launchLocked');
    else lb.removeAttribute('title');
  }

  // 동적 버튼 (GitHub 확인 / 받기) — 매번 새로 그림
  const slot = card.querySelector('.sync-actions');
  slot.textContent = '';
  if (st.showCheck) {
    const cb = document.createElement('button');
    cb.type = 'button';
    cb.className = 'gh-check';
    cb.textContent = t('checkRemote');
    cb.addEventListener('click', () => doFetch(p.name, cb));
    slot.appendChild(cb);
  }
  if (st.showPull) {
    const pb = document.createElement('button');
    pb.type = 'button';
    pb.className = 'gh-pull';
    pb.title = t('pullHint');
    pb.textContent = t('pull');
    pb.addEventListener('click', () => doPull(p.name, pb));
    slot.appendChild(pb);
  }
}

async function doLaunch(name, btn, card) {
  // 이미 이 PC 에서 실행 중이면 중복 실행 전에 확인(경고 후 허용)
  const p = projects.get(name);
  if (p && p.running && !(await dialogConfirm(t('launchRunningConfirm')))) return;
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

async function doFetch(name, btn) {
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
      syncCache.set(name, { failed: true });
      checked.add(name); // 확인 실패해도 작업은 막지 않음
      showBanner(t('fetchFail', data.error ?? t('serverError')));
    } else {
      syncCache.set(name, { ahead: data.ahead, behind: data.behind, state: classify(data.ahead, data.behind) });
      checked.add(name);
    }
  } catch {
    syncCache.set(name, { failed: true });
    checked.add(name);
    showBanner(t('fetchReqFail'));
  } finally {
    const card = findCard(name);
    if (card) renderStatus(card);
  }
}

// grid 안에서 data-name 으로 카드 DOM 을 찾는다 (특수문자 안전).
function findCard(name) {
  return Array.from(grid.children).find((el) => el.dataset && el.dataset.name === name) || null;
}

async function doPull(name, btn) {
  if (!(await dialogConfirm(t('pullConfirm', name)))) return;
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
      syncCache.set(name, { ahead: 0, behind: 0, state: 'synced' });
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

async function doClone() {
  const url = ((await dialogPrompt(t('clonePrompt'), { placeholder: 'https://github.com/owner/repo' })) || '').trim();
  if (!url) return;
  hideBanner();
  cloneProjectBtn.disabled = true;
  const original = cloneProjectBtn.textContent;
  cloneProjectBtn.textContent = t('cloning');
  try {
    const res = await fetch('/api/projects/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (data.ok) {
      // 갓 가져온 프로젝트는 원격과 동일 → 게이트 자동 통과(즉시 진입 가능)
      checked.add(data.name);
      syncCache.set(data.name, { ahead: 0, behind: 0, state: 'synced' });
      loadProjects();
    } else {
      showBanner(t('cloneFail', data.error ?? t('unknownError')));
    }
  } catch {
    showBanner(t('cloneReqFail'));
  } finally {
    cloneProjectBtn.disabled = false;
    cloneProjectBtn.textContent = original;
  }
}
// ── GitHub 가져오기 모달 ──────────────────────────────────────────────
let importRepos = []; // 마지막으로 불러온 목록(검색 필터의 원본)

const importIsOpen = () => !importModal.classList.contains('hidden');

function setImportStatus(msg) {
  importStatus.textContent = msg || '';
  importStatus.classList.toggle('hidden', !msg);
}

function closeImportModal() {
  importModal.classList.add('hidden');
  cloneProjectBtn.focus();
}

// 현재 검색어에 맞춰 목록을 그린다. 비면 importEmpty 표시.
function renderImportList() {
  const q = importSearch.value.trim().toLowerCase();
  importList.innerHTML = '';
  const rows = importRepos.filter((r) => r.name.toLowerCase().includes(q));
  setImportStatus(rows.length === 0 ? t('importEmpty') : '');
  for (const r of rows) {
    const li = document.createElement('li');
    const nm = document.createElement('span');
    nm.className = 'repo-name';
    nm.textContent = r.name;
    const vis = document.createElement('span');
    vis.className = 'repo-vis';
    vis.textContent = r.visibility;
    li.append(nm, vis);
    if (r.imported) {
      li.classList.add('imported');
      const tag = document.createElement('span');
      tag.className = 'repo-tag';
      tag.textContent = t('importAlreadyHave');
      li.appendChild(tag);
    } else {
      const when = document.createElement('span');
      when.className = 'repo-when';
      when.textContent = relativeTime(r.updatedAt);
      li.appendChild(when);
      li.addEventListener('click', () => doImportClone(r, li));
    }
    importList.appendChild(li);
  }
}

// gh 없음/목록 에러 → 안내 + "URL 직접 입력" 폴백
function renderImportFallback(errMsg) {
  importRepos = [];
  importList.innerHTML = '';
  setImportStatus(t('importError', errMsg ?? ''));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'import-fallback';
  btn.textContent = t('importManualFallback');
  btn.addEventListener('click', () => { closeImportModal(); doClone(); });
  importStatus.appendChild(document.createElement('br'));
  importStatus.appendChild(btn);
}

// 행 클릭 → gh repo clone → 성공 시 게이트 자동 통과 등록 후 새로고침
async function doImportClone(repo, li) {
  if (li.classList.contains('imported')) return; // 진행 중 재클릭 차단
  hideBanner();
  li.classList.add('imported');
  const when = li.querySelector('.repo-when');
  if (when) when.textContent = t('importRepoCloning');
  try {
    const res = await fetch('/api/github/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameWithOwner: repo.nameWithOwner, name: repo.name }),
    });
    const data = await res.json();
    if (data.ok) {
      // 갓 가져온 프로젝트는 원격과 동일 → 게이트 자동 통과(즉시 진입 가능)
      checked.add(data.name);
      syncCache.set(data.name, { ahead: 0, behind: 0, state: 'synced' });
      closeImportModal();
      loadProjects();
    } else {
      li.classList.remove('imported');
      if (when) when.textContent = relativeTime(repo.updatedAt);
      showBanner(t('cloneFail', data.error ?? t('unknownError')));
    }
  } catch {
    li.classList.remove('imported');
    if (when) when.textContent = relativeTime(repo.updatedAt);
    showBanner(t('cloneReqFail'));
  }
}

async function openImportModal() {
  hideBanner();
  importTitle.textContent = t('importTitle');
  importClose.title = t('importClose');
  importClose.setAttribute('aria-label', t('importClose'));
  importSearch.placeholder = t('importSearchPlaceholder');
  importSearch.setAttribute('aria-label', t('importSearchPlaceholder'));
  importSearch.value = '';
  importRepos = [];
  importList.innerHTML = '';
  setImportStatus(t('importLoading'));
  importModal.classList.remove('hidden');
  importSearch.focus();
  try {
    const res = await fetch('/api/github/repos');
    const data = await res.json();
    if (!importIsOpen()) return; // 사용자가 그새 닫음
    if (data.ok) {
      importRepos = data.repos || [];
      renderImportList();
    } else {
      renderImportFallback(data.error);
    }
  } catch {
    if (importIsOpen()) renderImportFallback('');
  }
}

cloneProjectBtn.addEventListener('click', openImportModal);
importClose.addEventListener('click', closeImportModal);
importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); }); // backdrop
importSearch.addEventListener('input', renderImportList);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && importIsOpen()) closeImportModal(); });
window.addEventListener('i18n:change', () => {
  if (!importIsOpen()) return;
  importTitle.textContent = t('importTitle');
  importClose.title = t('importClose');
  importClose.setAttribute('aria-label', t('importClose'));
  importSearch.placeholder = t('importSearchPlaceholder');
  importSearch.setAttribute('aria-label', t('importSearchPlaceholder'));
  renderImportList();
});

// ── 새 프로젝트 모달 ──────────────────────────────────────────────
const createIsOpen = () => !createModal.classList.contains('hidden');

function setCreateError(msg) {
  createError.textContent = msg || '';
  createError.classList.toggle('hidden', !msg);
}

// 모달 정적 텍스트(제목·입력 placeholder·버튼)를 현재 언어로 갱신.
function applyCreateTexts() {
  createTitle.textContent = t('createTitle');
  createClose.title = t('importClose');
  createClose.setAttribute('aria-label', t('importClose'));
  createInput.placeholder = t('createPrompt');
  createInput.setAttribute('aria-label', t('createPrompt'));
  createSubmit.textContent = t('createConfirm');
  createCancel.textContent = t('createCancel');
}

function openCreateModal() {
  hideBanner();
  applyCreateTexts();
  createInput.value = '';
  setCreateError('');
  createModal.classList.remove('hidden');
  createInput.focus();
}

function closeCreateModal() {
  createModal.classList.add('hidden');
  newProjectBtn.focus();
}

async function submitCreate() {
  const name = createInput.value.trim();
  if (!name) { createInput.focus(); return; }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    setCreateError(t('createAsciiOnly', name));
    createInput.focus();
    return;
  }
  setCreateError('');
  createSubmit.disabled = true;
  try {
    const res = await fetch('/api/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!createIsOpen()) return; // 사용자가 그새 닫음
    if (data.ok) {
      closeCreateModal();
      loadProjects();
    } else {
      setCreateError(data.error === 'ascii only' ? t('createAsciiOnly', name) : t('createFail', data.error ?? t('unknownError')));
    }
  } catch {
    if (createIsOpen()) setCreateError(t('createReqFail'));
  } finally {
    createSubmit.disabled = false;
  }
}

newProjectBtn.addEventListener('click', openCreateModal);
createClose.addEventListener('click', closeCreateModal);
createCancel.addEventListener('click', closeCreateModal);
createModal.addEventListener('click', (e) => { if (e.target === createModal) closeCreateModal(); }); // backdrop
createSubmit.addEventListener('click', submitCreate);
createInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitCreate(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && createIsOpen()) closeCreateModal(); });
window.addEventListener('i18n:change', () => { if (createIsOpen()) applyCreateTexts(); });
// ── 삭제 모달 ──────────────────────────────────────────────
const deleteModal = document.getElementById('delete-modal');
const deleteTitle = document.getElementById('delete-title');
const deleteClose = document.getElementById('delete-close');
const deleteDesc = document.getElementById('delete-desc');
const deleteRunning = document.getElementById('delete-running');
const deleteGhRow = document.getElementById('delete-gh-row');
const deleteGhCheck = document.getElementById('delete-gh-check');
const deleteGhLabel = document.getElementById('delete-gh-label');
const deleteError = document.getElementById('delete-error');
const deleteCancel = document.getElementById('delete-cancel');
const deleteSubmit = document.getElementById('delete-submit');
let deleteName = null;

const deleteIsOpen = () => !deleteModal.classList.contains('hidden');

function setDeleteError(msg) {
  deleteError.textContent = msg || '';
  deleteError.classList.toggle('hidden', !msg);
}

function applyDeleteTexts() {
  deleteTitle.textContent = t('deleteModalTitle');
  deleteClose.title = t('importClose');
  deleteClose.setAttribute('aria-label', t('importClose'));
  deleteCancel.textContent = t('createCancel');
  deleteSubmit.textContent = t('deleteConfirm');
}

async function openDeleteModal(name) {
  hideBanner();
  deleteName = name;
  const p = projects.get(name);
  applyDeleteTexts();
  deleteDesc.textContent = t('deleteDesc', name);
  setDeleteError('');
  deleteGhCheck.checked = false;
  deleteGhRow.classList.add('hidden');
  const running = !!(p && p.running);
  deleteRunning.textContent = running ? t('deleteRunning') : '';
  deleteRunning.classList.toggle('hidden', !running);
  deleteSubmit.disabled = running;
  deleteModal.classList.remove('hidden');
  deleteCancel.focus();
  try {
    const res = await fetch('/api/projects/remote?name=' + encodeURIComponent(name));
    const data = await res.json();
    if (!deleteIsOpen() || deleteName !== name) return;
    if (data.ok && data.nameWithOwner) {
      deleteGhLabel.textContent = t('deleteGhLabel', data.nameWithOwner);
      deleteGhRow.classList.remove('hidden');
    }
  } catch { /* 원격 조회 실패해도 로컬 삭제는 가능 */ }
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  deleteName = null;
}

async function submitDelete() {
  if (!deleteName) return;
  const name = deleteName;
  const deleteGithub = deleteGhCheck.checked;
  setDeleteError('');
  deleteSubmit.disabled = true;
  try {
    const res = await fetch('/api/projects/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, deleteGithub }),
    });
    if (res.status === 409) { setDeleteError(t('deleteRunning')); return; }
    const data = await res.json();
    if (data.ok) {
      closeDeleteModal();
      loadProjects();
    } else if (data.github && !data.github.ok) {
      setDeleteError(t('deleteGhFail', data.github.error));
    } else {
      setDeleteError(t('deleteFail', (data.local && data.local.error) || t('unknownError')));
    }
  } catch {
    if (deleteIsOpen()) setDeleteError(t('deleteReqFail'));
  } finally {
    deleteSubmit.disabled = false;
  }
}

deleteClose.addEventListener('click', closeDeleteModal);
deleteCancel.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); }); // backdrop
deleteSubmit.addEventListener('click', submitDelete);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && deleteIsOpen()) closeDeleteModal(); });
window.addEventListener('i18n:change', () => { if (deleteIsOpen()) applyDeleteTexts(); });

// ── 메모 모달 ──────────────────────────────────────────────
const noteModal = document.getElementById('note-modal');
const noteTitle = document.getElementById('note-title');
const noteClose = document.getElementById('note-close');
const noteDesc = document.getElementById('note-desc');
const noteInput = document.getElementById('note-input');
const noteError = document.getElementById('note-error');
const noteCancel = document.getElementById('note-cancel');
const noteSubmit = document.getElementById('note-submit');
let noteName = null;

const noteIsOpen = () => !noteModal.classList.contains('hidden');

function setNoteError(msg) {
  noteError.textContent = msg || '';
  noteError.classList.toggle('hidden', !msg);
}

function applyNoteTexts() {
  noteTitle.textContent = t('noteModalTitle');
  noteClose.title = t('importClose');
  noteClose.setAttribute('aria-label', t('importClose'));
  noteInput.placeholder = t('notePlaceholder');
  noteInput.setAttribute('aria-label', t('notePlaceholder'));
  noteCancel.textContent = t('createCancel');
  noteSubmit.textContent = t('noteSave');
}

// 이름 변경: 로컬 폴더 + claude 이력 + 메모 + (origin 이 GitHub 면) 저장소 이름
async function doRename(name, btn) {
  // 다른 claude 창(다른 폴더에서 띄운 세션)이 이 폴더를 수정 중이면 프로세스로 감지 못 함 → 사용자 확인
  if (!(await dialogConfirm(t('renameConfirm', name)))) return;
  const raw = await dialogPrompt(t('renamePrompt', name), { value: name });
  if (raw === null) return;
  const newName = raw.trim();
  if (!newName || newName === name) return;
  if (!/^[A-Za-z0-9._-]+$/.test(newName)) {
    // 한글·공백·특수문자: GitHub 가 거부하고 claude 이력 폴더명도 겹칠 수 있음
    await dialogAlert(t('renameAsciiOnly', newName));
    return;
  }
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
    } else if (data.error === 'running') {
      showBanner(t('deleteRunning'));
    } else if (data.error === 'ascii only') {
      showBanner(t('renameAsciiOnly', newName));
    } else if (data.error === 'self') {
      showBanner(t('renameSelfBlocked'));
    } else {
      showBanner(t('renameFail', data.error ?? t('unknownError')));
    }
  } catch {
    showBanner(t('renameReqFail'));
  } finally {
    btn.disabled = false;
  }
}

function openNoteModal(name) {
  hideBanner();
  noteName = name;
  const p = projects.get(name);
  applyNoteTexts();
  noteDesc.textContent = name;
  setNoteError('');
  noteInput.value = (p && p.note) || '';
  noteModal.classList.remove('hidden');
  noteInput.focus();
}

function closeNoteModal() {
  noteModal.classList.add('hidden');
  noteName = null;
}

async function submitNote() {
  if (!noteName) return;
  const name = noteName;
  const note = noteInput.value;
  setNoteError('');
  noteSubmit.disabled = true;
  try {
    const res = await fetch('/api/projects/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, note }),
    });
    const data = await res.json();
    if (data.ok) {
      closeNoteModal();
      loadProjects();
    } else {
      setNoteError(t('noteFail', data.error ?? t('unknownError')));
    }
  } catch {
    if (noteIsOpen()) setNoteError(t('noteReqFail'));
  } finally {
    noteSubmit.disabled = false;
  }
}

noteClose.addEventListener('click', closeNoteModal);
noteCancel.addEventListener('click', closeNoteModal);
noteModal.addEventListener('click', (e) => { if (e.target === noteModal) closeNoteModal(); }); // backdrop
noteSubmit.addEventListener('click', submitNote);
noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitNote(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && noteIsOpen()) closeNoteModal(); });
window.addEventListener('i18n:change', () => { if (noteIsOpen()) applyNoteTexts(); });

// 새로고침: 목록·상태만 다시 읽고 확인 상태(checked/syncCache)는 유지.
// (초기화는 페이지를 새로 열 때 자동으로 — 모듈 상태가 빈 값으로 재초기화됨)
refreshBtn.addEventListener('click', loadProjects);

const shutdownBtn = document.getElementById('shutdown');
shutdownBtn.addEventListener('click', async () => {
  if (!(await dialogConfirm(t('shutdownConfirm'), { danger: true }))) return;
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
  loadRoot().then(loadProjects);
});

applyStaticI18n();
loadRoot().then(loadProjects);
