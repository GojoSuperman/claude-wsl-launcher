// public/team-modal.js
// 팀 정보 창: 역할·저장소·팀원, 지금 상태(main·PR), PR 목록, "claude 에게 할 말"(복사), GitHub 열기·claude 실행.
// 모든 값은 textContent 로 넣는다(저장소·PR 제목은 외부 입력).
import { t } from './i18n.js';

let ctx = () => null;
let launch = () => {};
let current = null;

const modal = document.getElementById('team-modal');
const titleEl = document.getElementById('team-title');
const body = document.getElementById('team-body');
const closeBtn = document.getElementById('team-close');

export function initTeamModal({ getContext, onLaunch }) {
  ctx = getContext;
  launch = onLaunch;
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const roleText = (info) => {
  if (!info) return '—';
  const perm = t('teamPerm')[info.permission] || info.permission || '';
  const r = { leader: t('roleLeader', Math.max(0, (info.collaborators ?? 1) - 1)), member: t('roleMember'), readonly: t('roleReadonly') }[info.role] || '';
  return perm ? `${r} (${perm})` : r;
};

function render() {
  const c = ctx(current);
  if (!c) return;
  const { info, sync, checked, status } = c;
  titleEl.textContent = t('teamTitle', c.name);
  body.textContent = '';

  const dl = el('dl', 'team-dl');
  const row = (k, v) => { dl.append(el('dt', '', k), el('dd', '', v)); };
  row(t('teamMyRole'), roleText(info));
  if (info) row(t('teamRepo'), `${info.repo} (${info.visibility === 'PUBLIC' ? t('ghPublic') : t('ghPrivate')})`);
  if (info?.members?.length) row(t('teamMembers'), info.members.map((m) => (m.toLowerCase() === info.owner.toLowerCase() ? `👑 ${m}` : `👥 ${m}`)).join(' · '));
  body.appendChild(dl);

  body.appendChild(el('div', 'team-sec', t('teamState')));
  if (!checked || !sync || sync.failed) {
    body.appendChild(el('p', 'team-note', t('teamNotChecked')));
  } else {
    const ul = el('ul', 'team-list');
    const li = (s) => ul.appendChild(el('li', '', s));
    if (sync.branch) li(t('teamStBranch', sync.branch));
    const pr = sync.pr;
    if (pr?.state === 'MERGED') li(t('teamStMerged', pr.number));
    else if (pr?.state === 'OPEN' && pr.mergeable === 'CONFLICTING') li(t('teamStConflict', pr.number));
    else if (pr?.state === 'OPEN') li(t('teamStPrOpen', pr.number));
    if (status.stripKey === 'stripBranchNotPushed') li(t('teamStNotPushed'));
    if (sync.mainBehind > 0) li(t('teamStMainBehind', sync.mainBehind));
    else if (sync.mainBehind === 0) li(t('teamStMainSynced'));
    body.appendChild(ul);

    const prLink = (n, title, tail, url) => {
      const item = el('li');
      const a = el('a', '', `#${n}`);
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      item.append(a, ` ${title} — ${tail}`);
      return item;
    };
    if (info?.role === 'leader') {
      body.appendChild(el('div', 'team-sec', t('teamPrReview')));
      const list = sync.openPrList || [];
      if (!list.length) body.appendChild(el('p', 'team-note', t('teamNone')));
      else { const ul2 = el('ul', 'team-list'); for (const p of list) ul2.appendChild(prLink(p.number, p.title, p.author || '', p.url)); body.appendChild(ul2); }
    }
    if (pr) {
      body.appendChild(el('div', 'team-sec', t('teamPrMine')));
      const st = pr.state === 'OPEN' && pr.mergeable === 'CONFLICTING' ? 'CONFLICTING' : pr.state;
      const ul3 = el('ul', 'team-list');
      ul3.appendChild(prLink(pr.number, pr.title, `${t('teamPrState')[st] || st}${pr.author ? ` · ${pr.author}` : ''}`, pr.url));
      body.appendChild(ul3);
    }
  }

  if (status.hintKey) {
    const hint = status.hintArg !== undefined ? t(status.hintKey, status.hintArg) : t(status.hintKey);
    body.appendChild(el('div', 'team-sec', t('teamHint')));
    const box = el('div', 'team-hint');
    const q = el('q', '', hint);
    const copy = el('button', '', t('teamCopy'));
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(hint); copy.textContent = t('teamCopied'); } catch { copy.textContent = t('teamCopyFail'); }
      setTimeout(() => { copy.textContent = t('teamCopy'); }, 1500);
    });
    box.append(q, copy);
    body.appendChild(box);
  }

  const actions = el('div', 'team-actions');
  if (info?.repo) {
    const gh = el('button', 'ghost', t('teamOpenGithub'));
    gh.type = 'button';
    gh.addEventListener('click', () => window.open(`https://github.com/${info.repo}`, '_blank', 'noopener'));
    actions.appendChild(gh);
  }
  const run = el('button', '', t('launchContinue'));
  run.type = 'button';
  run.disabled = status.locked;
  run.addEventListener('click', () => { close(); launch(c.name); });
  actions.appendChild(run);
  body.appendChild(actions);
}

export function openTeamModal(name) {
  current = name;
  render();
  modal.classList.remove('hidden');
  closeBtn.focus();
}
function close() { modal.classList.add('hidden'); current = null; }
closeBtn.addEventListener('click', close);
modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
window.addEventListener('i18n:change', () => { if (current) render(); });
