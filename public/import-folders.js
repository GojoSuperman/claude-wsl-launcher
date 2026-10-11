// public/import-folders.js
// 가져오기 창의 '내 PC' · 'WSL' 탭: 첫 화면(바로가기 타일) → 클릭해 폴더 안으로 → 줄마다 [가져오기].
//   createFolderPane({ el, home, projectsRoot, onPick }) → { show(kind) }   kind = 'pc' | 'wsl'
//   onPick(absPath) = 그 폴더를 가져오기(점검·확인은 app.js importPath).
import { t } from './i18n.js';

const PLACE_ICON = { desktop: '🖥️', downloads: '⬇️', documents: '📄', home: '🏠' };
const PLACE_LABEL = { desktop: 'placeDesktop', downloads: 'placeDownloads', documents: 'placeDocuments' };
const baseName = (p) => p.split('/').filter(Boolean).pop() || p;

export function createFolderPane({ el, home, projectsRoot, onPick }) {
  el.innerHTML = `
    <div class="ifp-hint"></div>
    <div class="ifp-places"></div>
    <div class="ifp-browse hidden">
      <div class="ifp-bar">
        <button type="button" class="ifp-home ghost small"></button>
        <span class="ifp-path"></span>
      </div>
      <ul class="ifp-list import-list"></ul>
      <div class="ifp-actions"><button type="button" class="ifp-pick small"></button></div>
    </div>
    <div class="ifp-status import-status hidden"></div>`;
  const $ = (c) => el.querySelector('.' + c);
  const places = $('ifp-places'); const browse = $('ifp-browse'); const list = $('ifp-list'); const status = $('ifp-status');
  let kind = 'pc';
  let cur = null;
  let seq = 0; // 늦게 도착한 응답이 새 화면을 덮지 않게

  // /mnt/c/Users/x → C:\Users\x (내 PC 탭은 Windows 식으로 보여 준다), WSL 은 ~/…
  const showPath = (p) => {
    const m = /^\/mnt\/([a-zA-Z])(\/.*)?$/.exec(p);
    if (m) return `${m[1].toUpperCase()}:\\${(m[2] || '').slice(1).replace(/\//g, '\\')}`;
    return home && (p === home || p.startsWith(home + '/')) ? '~' + p.slice(home.length) : p;
  };
  const setStatus = (msg) => { status.textContent = msg || ''; status.classList.toggle('hidden', !msg); };
  const getJson = async (url) => { try { return await (await fetch(url)).json(); } catch { return { ok: false, error: 'connect' }; } };

  function tile(icon, label, sub, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ifp-tile';
    const i = document.createElement('span'); i.className = 'ifp-tile-icon'; i.textContent = icon;
    const l = document.createElement('span'); l.className = 'ifp-tile-label'; l.textContent = label;
    b.append(i, l);
    if (sub) { const s = document.createElement('span'); s.className = 'ifp-tile-sub'; s.textContent = sub; b.appendChild(s); }
    b.addEventListener('click', onClick);
    return b;
  }
  function group(label, tiles) {
    if (!tiles.length) return;
    const h = document.createElement('div'); h.className = 'import-section-label'; h.textContent = label;
    const g = document.createElement('div'); g.className = 'ifp-grid';
    g.append(...tiles);
    places.append(h, g);
  }

  async function showHome() {
    const my = ++seq;
    cur = null;
    browse.classList.add('hidden');
    places.classList.remove('hidden');
    places.innerHTML = '';
    setStatus(t('importLoading'));
    if (kind === 'pc') {
      const d = await getJson('/api/folders/places');
      if (my !== seq) return;
      setStatus(d.ok ? '' : t('pickerLoadFail', d.error));
      if (!d.ok) return;
      group(t('importFavorites'), d.favorites.map((f) => tile(PLACE_ICON[f.kind], f.kind === 'home' ? baseName(f.path) : t(PLACE_LABEL[f.kind]), showPath(f.path), () => open(f.path))));
      group(t('importDrives'), d.drives.map((v) => tile('💽', `${v.letter}:`, '', () => open(v.path))));
      if (!d.favorites.length && !d.drives.length) setStatus(t('importNoWindows'));
    } else {
      const d = await getJson(`/api/folders?path=${encodeURIComponent(home)}`);
      if (my !== seq) return;
      setStatus(d.ok ? '' : t('pickerLoadFail', d.error));
      if (!d.ok) return;
      const root = projectsRoot.replace(/\/+$/, '');
      const entries = d.entries.filter((e) => e.path !== root);
      group(t('importWslHome'), entries.map((e) => tile('📁', e.name, e.isRepo ? t('pickerIsRepo') : e.repos > 0 ? t('pickerRepos', e.repos) : '', () => open(e.path))));
      if (!entries.length) setStatus(t('importWslEmpty'));
    }
  }

  async function open(p) {
    const my = ++seq;
    const d = await getJson(`/api/folders?path=${encodeURIComponent(p)}`);
    if (my !== seq) return;
    if (!d.ok) { setStatus(t('pickerLoadFail', d.error)); return; }
    cur = d.path;
    places.classList.add('hidden');
    browse.classList.remove('hidden');
    $('ifp-path').textContent = showPath(cur);
    $('ifp-path').title = cur;
    list.innerHTML = '';
    setStatus('');
    if (d.parent && d.path !== home) {
      const up = document.createElement('li');
      up.className = 'ifp-up';
      up.textContent = '.. ' + t('pickerUp');
      up.addEventListener('click', () => open(d.parent));
      list.appendChild(up);
    }
    for (const e of d.entries) {
      if (e.path === projectsRoot.replace(/\/+$/, '')) continue;
      const li = document.createElement('li');
      const name = document.createElement('span'); name.className = 'ifp-name'; name.textContent = '📁 ' + e.name;
      li.appendChild(name);
      if (e.isRepo || e.repos > 0) {
        const b = document.createElement('span'); b.className = 'ifp-badge';
        b.textContent = e.isRepo ? t('pickerIsRepo') : t('pickerRepos', e.repos);
        li.appendChild(b);
      }
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ifp-row-pick small'; btn.textContent = t('importRowPick');
      btn.addEventListener('click', (ev) => { ev.stopPropagation(); onPick(e.path); });
      li.appendChild(btn);
      li.addEventListener('click', () => open(e.path));
      list.appendChild(li);
    }
    if (d.entries.length === 0) setStatus(t('pickerEmpty'));
  }

  function applyTexts() {
    $('ifp-hint').textContent = t(kind === 'pc' ? 'importPcHint' : 'importWslHint');
    $('ifp-home').textContent = t('importBackHome');
    $('ifp-pick').textContent = t('importThisFolder');
  }
  $('ifp-home').addEventListener('click', showHome);
  $('ifp-pick').addEventListener('click', () => { if (cur) onPick(cur); });

  return {
    show(k) { kind = k; applyTexts(); showHome(); },
    refreshTexts() { applyTexts(); if (cur) open(cur); else showHome(); },
  };
}
