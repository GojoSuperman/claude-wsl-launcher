// server/index.js
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectEnv } from './env.js';
import { normalizeRoot } from './config.js';
import { listDir, windowsPlaces } from './folders.js';
import { list } from './scanner.js';
import { hasSession } from './session.js';
import { resolveProject } from './paths.js';
import { launch } from './launcher.js';
import { status as gitStatus, aheadBehind, originRepo, defaultBranch as gitDefaultBranch, aheadBehindRef, localGithubUser } from './git.js';
import { setVisibility } from './github-visibility.js';
import { createRepoInfoLookup, createMeLookup } from './repo-info.js';
import { prForBranch, openPrs } from './pr-status.js';
import { computeRole, isTeamRole, infoForUser } from '../public/team-role.js';
import { fetch as gitFetch, pull as gitPull } from './git-sync.js';
import { runningPaths, isRunning } from './running.js';
import { create as createProject } from './creator.js';
import { trashLocal } from './deleter.js';
import { listTrash, restoreTrash, purgeTrash, defaultTrashDir } from './trash.js';
import { readSeen, writeSeen, userHistory } from './whats-new.js';
import { rename as renameProject } from './renamer.js';
import { readAll as readNotes, setNote } from './notes.js';
import { readOrder, writeOrder, renameInOrder } from './order.js';
import { readTabs, writeTabs, renameInTabs } from './tabs.js';
import {
  DEFAULT_ID, readAccounts, listAccounts, accountLabel, addAccount, setAlias, removeAccount,
  resolveLaunchAccount, rememberLast, renameInAccounts,
} from './accounts.js';
import { clone as cloneProject } from './cloner.js';
import { importFolder, inspectImport } from './importer.js';
import { listRepos, cloneRepo, parseRepos, deleteRepo } from './github.js';
import { check as checkUpdate, update as runUpdate } from './updater.js';
import { createConsoleStream } from './console-stream.js';
import { createIdleShutdown } from './idle-shutdown.js';
import { findRunningLauncher } from './single-instance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 이 대시보드 서버 자신의 프로젝트 폴더 — 이름 변경 대상에서 제외(서버가 깨짐)
const SELF_PATH = fs.realpathSync(path.join(__dirname, '..'));
function isSelf(full) {
  try { return fs.realpathSync(full) === SELF_PATH; } catch { return false; }
}
// 기본 포트는 잘 안 쓰는 사설 범위로(4173 은 Vite preview 기본값이라 충돌 잦음).
const PORT = Number(process.env.PORT) || 41730;
const MAX_PORT_TRIES = 10; // 사용 중이면 41730..41739 순차 시도

let server; // 실제 바인딩된 http 서버(포트 폴백 후 확정)

// 서버 콘솔(stdout/stderr)을 가로채 브라우저로 흘려보낸다. 이후 모든 로그가 ring 에 적재됨.
const consoleStream = createConsoleStream();
consoleStream.tee();

let env;
try {
  env = detectEnv(process.env);
} catch (e) {
  console.error('[env] 시작 실패:', e.message);
  process.exit(1);
}
console.log(`[env] distro=${env.distro} projectsRoot=${env.projectsRoot} (${env.projectsRootSource})`);
// 작업 폴더는 WSL 안의 ~/projects 로 고정 — 없으면 만든다
try { fs.mkdirSync(env.projectsRoot, { recursive: true }); } catch (e) { console.warn('[env] 작업 폴더 생성 실패:', e.message); }

// 프로젝트 메모 저장 파일 (launch.sh LOG_DIR 과 동일 관행: XDG_STATE_HOME 우선)
const NOTES_FILE = path.join(
  process.env.XDG_STATE_HOME || path.join(env.home, '.local', 'state'),
  'project-launcher', 'notes.json'
);
// 사용자가 드래그로 정한 카드 순서 (같은 폴더)
const ORDER_FILE = path.join(path.dirname(NOTES_FILE), 'order.json');
// 사용자가 만든 작업 탭 + 프로젝트별 탭 배정 (같은 폴더)
const TABS_FILE = path.join(path.dirname(NOTES_FILE), 'tabs.json');
// 여러 계정: 추가 계정 목록·별명·프로젝트별 마지막 계정 (같은 폴더)
const ACCOUNTS_FILE = path.join(path.dirname(NOTES_FILE), 'accounts.json');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/xterm', express.static(path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm')));
app.use('/vendor/addon-fit', express.static(path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-fit')));

app.get('/api/projects', async (req, res) => {
  try {
    const dirs = list(env.projectsRoot);
    const runSet = runningPaths();
    const notes = readNotes(NOTES_FILE); // 프로젝트명 → 메모
    const projects = await Promise.all(
      dirs.map(async (p) => ({
        name: p.name,
        path: p.path,
        hasSession: hasSession(env.home, p.path),
        git: await gitStatus(p.path),
        running: isRunning(runSet, p.path),
        self: isSelf(p.path),
        github: await originRepo(p.path), // origin 이 GitHub 면 'owner/repo', 아니면 null
        note: notes[p.name] || '', // 메모(없으면 빈 문자열)
      }))
    );
    const accState = readAccounts(ACCOUNTS_FILE);
    res.json({
      projects, order: readOrder(ORDER_FILE), tabs: readTabs(TABS_FILE),
      accounts: listAccounts(env.home, accState), lastByProject: accState.lastByProject,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/launch', async (req, res) => {
  const name = req.body?.name;
  const full = resolveProject(env.projectsRoot, name);
  if (!full) {
    return res.status(400).json({ ok: false, error: 'unknown project' });
  }
  // account: 계정 id. 생략하면 이 프로젝트가 마지막으로 쓴 계정(없으면 기본).
  // 대화 기록은 계정끼리 공유되므로 이어서 여부 판정은 기본 계정 기준 그대로.
  const state = readAccounts(ACCOUNTS_FILE);
  const pick = resolveLaunchAccount(state, name, req.body?.account);
  if (pick.error) {
    rememberLast(ACCOUNTS_FILE, name, DEFAULT_ID);
    return res.status(400).json({ ok: false, error: pick.error });
  }
  const list = listAccounts(env.home, state);
  const acct = list.find((a) => a.id === pick.id);
  if (!acct.exists) {
    return res.status(409).json({ ok: false, code: 'account-missing', id: acct.id, dir: acct.dir });
  }
  const label = list.length > 1 ? accountLabel(acct) : '';
  // 이미 claude 가 열려 있으면 두 번째 창은 새 대화로 — 같은 대화를 두 창이 따로 이어 가지 않게
  const cont = hasSession(env.home, full) && !isRunning(runningPaths(), full);
  try {
    await launch(env.distro, full, cont, { accountDir: acct.isDefault ? '' : acct.dir, label });
    rememberLast(ACCOUNTS_FILE, name, acct.id);
    res.json({ ok: true, continued: cont, account: { id: acct.id, label } });
  } catch (e) {
    res.status(500).json({ ok: false, error: `launch failed: ${e.message}` });
  }
});

// ── 여러 계정 ──
function accountsView() {
  const state = readAccounts(ACCOUNTS_FILE);
  return { accounts: listAccounts(env.home, state), lastByProject: state.lastByProject };
}
// 로그인 창: 그 계정으로 스캔 폴더에서 claude 실행(새 계정이면 claude 가 로그인 화면부터 띄운다)
async function openLoginWindow(acct) {
  await launch(env.distro, env.projectsRoot, false, { accountDir: acct.dir, label: accountLabel(acct) });
}

app.get('/api/accounts', (req, res) => {
  res.json(accountsView());
});

app.post('/api/accounts/add', async (req, res) => {
  const r = addAccount(env.home, ACCOUNTS_FILE);
  if (!r.ok) return res.json(r);
  try {
    await openLoginWindow(r.account);
    res.json({ ok: true, account: r.account });
  } catch (e) {
    // 계정은 만들어졌으니 유지 — 관리 창의 [로그인 창 열기]로 다시 시도
    res.json({ ok: true, account: r.account, loginError: e.message });
  }
});

app.post('/api/accounts/alias', (req, res) => {
  res.json(setAlias(ACCOUNTS_FILE, req.body?.id, req.body?.alias));
});

app.post('/api/accounts/remove', (req, res) => {
  res.json(removeAccount(ACCOUNTS_FILE, req.body?.id));
});

app.post('/api/accounts/login', async (req, res) => {
  const acct = accountsView().accounts.find((a) => a.id === req.body?.id && !a.isDefault);
  if (!acct) return res.status(400).json({ ok: false, error: 'unknown account' });
  if (!acct.exists) return res.status(409).json({ ok: false, code: 'account-missing', id: acct.id, dir: acct.dir });
  try {
    await openLoginWindow(acct);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/git/fetch', async (req, res) => {
  try {
    const full = resolveProject(env.projectsRoot, req.body?.name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    const r = await gitFetch(full);
    if (!r.ok) return res.json({ ok: false, error: r.error });
    const ab = await aheadBehind(full);
    const st = await gitStatus(full);
    const { repo, info } = await teamInfoOf(full);
    // 기본 브랜치: origin/HEAD → GitHub 기본 브랜치 → 모름(main 비교 생략)
    const def = (await gitDefaultBranch(full)) || info?.defaultBranch || null;
    const main = def ? await aheadBehindRef(full, `origin/${def}`) : null;
    const team = isTeamRole(info?.role);
    const onWork = st.branch && def && st.branch !== def;
    res.json({
      ok: true, ahead: ab.ahead, behind: ab.behind,
      branch: st.branch, defaultBranch: def,
      mainAhead: main ? main.ahead : null, mainBehind: main ? main.behind : null,
      pr: team && onWork ? await prForBranch(repo, st.branch) : null,
      openPrs: info?.role === 'leader' ? await openPrs(repo) : null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/git/pull', async (req, res) => {
  try {
    const full = resolveProject(env.projectsRoot, req.body?.name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    const r = await gitPull(full);
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GitHub 공개/비공개 조회 (gh CLI, 캐시). names 배열 → { name: 'PUBLIC'|'PRIVATE'|null }
// GitHub 저장소 정보(공개 여부·소유자·권한·협업자·기본 브랜치) — 저장소당 GraphQL 1회, 10분 캐시
const repoInfo = createRepoInfoLookup();
const me = createMeLookup();
/** 프로젝트 폴더 → { repo, info(+role) } . GitHub 아님/조회 실패면 info:null */
async function teamInfoOf(full) {
  const repo = await originRepo(full);
  if (!repo) return { repo: null, info: null };
  const info = await repoInfo.get(repo);
  if (!info) return { repo, info: null };
  // "나" = 이 폴더의 github.user 설정(계정 여럿인 PC) → 없으면 gh 활성 계정
  const active = await me.get();
  const who = (await localGithubUser(full)) || active;
  const view = infoForUser(info, who, active); // 폴더 사용자가 활성 계정과 다르면 권한을 협업자 목록으로
  return { repo, info: { ...view, repo, role: computeRole({ ...view, me: who }) } };
}
// 공개/비공개 전환: {name, visibility:'PUBLIC'|'PRIVATE'} → gh repo edit. 성공 시 캐시 무효화.
app.post('/api/github/visibility/set', async (req, res) => {
  try {
    const full = resolveProject(env.projectsRoot, req.body?.name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    const repo = await originRepo(full);
    if (!repo) return res.json({ ok: false, error: 'no github remote' });
    const r = await setVisibility(repo, req.body?.visibility);
    if (r.ok) repoInfo.invalidate(repo);
    res.json({ ...r, repo });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/github/visibility', async (req, res) => {
  try {
    const names = Array.isArray(req.body?.names) ? req.body.names.slice(0, 200) : [];
    const out = {};
    const info = {};
    // 동시 4개씩 — gh 호출 폭주 방지
    const queue = [...names];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const name = queue.shift();
        const full = resolveProject(env.projectsRoot, name);
        if (!full) { out[name] = null; info[name] = null; continue; }
        const t = await teamInfoOf(full);
        out[name] = t.info ? t.info.visibility : null;
        info[name] = t.info;
      }
    }));
    res.json({ ok: true, visibility: out, info });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 작업 폴더 조회. 작업 폴더는 ~/projects 고정(변경 불가).
app.get('/api/config', (req, res) => {
  res.json({ ok: true, projectsRoot: env.projectsRoot, source: env.projectsRootSource, home: env.home });
});
// 가져오기 창 폴더 탐색: 하위 폴더 목록(읽기 전용)
app.get('/api/folders', (req, res) => {
  const p = normalizeRoot(req.query?.path, env.home) || env.home;
  res.json(listDir(p));
});
// 가져오기 창 '내 PC' 탭 첫 화면: 바탕 화면·다운로드·문서·사용자 폴더 + 드라이브
app.get('/api/folders/places', (req, res) => {
  res.json({ ok: true, ...windowsPlaces() });
});
// 가져오기 전 점검: 이동/복사, 같은 GitHub 저장소 카드, 이름 겹침, 여러 저장소를 담은 폴더인지
app.post('/api/projects/import-check', async (req, res) => {
  try {
    const existing = await Promise.all(list(env.projectsRoot).map(async (p) => ({ name: p.name, github: await originRepo(p.path) })));
    res.json(await inspectImport({ projectsRoot: env.projectsRoot, home: env.home, src: normalizeRoot(req.body?.path, env.home), existing }));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
// 다른 곳의 작업 폴더를 ~/projects 로 가져오기: WSL 폴더는 이동, Windows 폴더(/mnt/…)는 복사
app.post('/api/projects/import-folder', async (req, res) => {
  try {
    const src = normalizeRoot(req.body?.path, env.home);
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : undefined;
    const r = await importFolder({
      projectsRoot: env.projectsRoot, home: env.home, src, name,
      isRunning: (p) => isRunning(runningPaths(), p), selfDir: SELF_PATH,
    });
    if (r.ok) console.log(`[import] ${src} → ${r.path} (${r.mode})`);
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/projects/create', async (req, res) => {
  try {
    const r = createProject(env.projectsRoot, req.body?.name);
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/projects/note', (req, res) => {
  try {
    const full = resolveProject(env.projectsRoot, req.body?.name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    res.json(setNote(NOTES_FILE, req.body.name, req.body?.note));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 카드 순서 저장: {order:[프로젝트명…]}. 빈 배열 = 이름순으로 되돌리기.
app.post('/api/order', (req, res) => {
  try {
    res.json(writeOrder(ORDER_FILE, req.body?.order));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 작업 탭 저장: {tabs:[{id,name}], assign:{프로젝트명:탭id}} 전체를 통째로 덮어쓴다.
app.post('/api/tabs', (req, res) => {
  try {
    res.json(writeTabs(TABS_FILE, req.body));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/projects/clone', async (req, res) => {
  try {
    const r = await cloneProject(env.projectsRoot, req.body?.url, req.body?.name);
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/projects/remote', async (req, res) => {
  try {
    const full = resolveProject(env.projectsRoot, req.query?.name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    const nameWithOwner = await originRepo(full);
    res.json({ ok: true, nameWithOwner });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// '새 기능' 창: 마지막으로 본 소식 id + 기존 사용자인지 + 예전에 쓰던 스캔 폴더 / 본 것으로 기록
const WHATS_NEW_FILE = path.join(path.dirname(NOTES_FILE), 'whats-new.json');
const OLD_CONFIG_FILE = path.join(process.env.XDG_CONFIG_HOME || path.join(env.home, '.config'), 'project-launcher', 'config.json');
app.get('/api/whats-new', (req, res) => {
  const u = userHistory({
    stateDir: path.dirname(NOTES_FILE), configFile: OLD_CONFIG_FILE, home: env.home, projectsRoot: env.projectsRoot,
    envRoot: process.env.PROJECTS_ROOT, hasProjects: list(env.projectsRoot).length > 0,
  });
  const home = env.home.replace(/\/+$/, '');
  const legacyRoot = u.legacyRoot && (u.legacyRoot === home || u.legacyRoot.startsWith(home + '/') ? '~' + u.legacyRoot.slice(home.length) : u.legacyRoot);
  res.json({ ok: true, seen: readSeen(WHATS_NEW_FILE), hasProjects: u.existing, legacyRoot }); // 화면 표시용으로 홈은 ~
});
app.post('/api/whats-new/seen', (req, res) => {
  res.json(writeSeen(WHATS_NEW_FILE, req.body?.id));
});

// 휴지통: 카드 삭제로 휴지통에 간 프로젝트 목록 / 되살리기({id, name?}) / 영구 삭제({id})
const TRASH_DIR = defaultTrashDir(process.env, env.home);
app.get('/api/trash', (req, res) => {
  res.json({ ok: true, items: listTrash({ trashDir: TRASH_DIR, projectsRoot: env.projectsRoot }) });
});
app.post('/api/trash/restore', (req, res) => {
  const r = restoreTrash({ trashDir: TRASH_DIR, projectsRoot: env.projectsRoot, id: req.body?.id, name: req.body?.name });
  if (r.ok) console.log(`[trash] 되살림: ${r.name}`);
  res.json(r);
});
app.post('/api/trash/purge', (req, res) => {
  const r = purgeTrash({ trashDir: TRASH_DIR, projectsRoot: env.projectsRoot, id: req.body?.id });
  if (r.ok) console.log(`[trash] 영구 삭제: ${req.body.id}`);
  res.json(r);
});

app.post('/api/projects/delete', async (req, res) => {
  try {
    const name = req.body?.name;
    const full = resolveProject(env.projectsRoot, name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    if (isSelf(full)) return res.status(400).json({ ok: false, error: 'self' });
    if (isRunning(runningPaths(), full)) {
      return res.status(409).json({ ok: false, error: 'running' });
    }
    let github;
    if (req.body?.deleteGithub === true) {
      const nameWithOwner = await originRepo(full);
      if (!nameWithOwner) {
        return res.json({ ok: false, github: { ok: false, error: 'no github remote' } });
      }
      github = await deleteRepo(nameWithOwner);
      if (!github.ok) {
        // GitHub 실패 → 로컬은 보존(부분 삭제 방지)
        return res.json({ ok: false, github });
      }
    }
    const local = await trashLocal(env.projectsRoot, name);
    res.json({ ok: local.ok, github, local });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/github/repos', async (req, res) => {
  try {
    const r = await listRepos();
    if (!r.ok) { res.json({ ok: false, error: r.error, code: r.code }); return; }
    const existing = list(env.projectsRoot).map((d) => d.name);
    res.json({ ok: true, repos: parseRepos(r.raw, existing) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/github/clone', async (req, res) => {
  try {
    const r = await cloneRepo(env.projectsRoot, req.body?.nameWithOwner, req.body?.name);
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/projects/rename', async (req, res) => {
  try {
    const runSet = runningPaths();
    const r = await renameProject({
      projectsRoot: env.projectsRoot,
      home: env.home,
      name: req.body?.name,
      newName: req.body?.newName,
      notesFile: NOTES_FILE,
      isRunning: (full) => isRunning(runSet, full),
      isSelf,
    });
    if (r.ok) {
      // 순서 자리·탭 배정·마지막 계정 유지
      renameInOrder(ORDER_FILE, req.body.name, req.body.newName);
      renameInTabs(TABS_FILE, req.body.name, req.body.newName);
      renameInAccounts(ACCOUNTS_FILE, req.body.name, req.body.newName);
    }
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// launcher 가 "이게 우리 대시보드인가"를 식별하는 마커. 실제 바인딩 포트도 알려준다.
app.get('/api/health', (req, res) => {
  res.json({ app: 'claude-wsl-launcher', port: server?.address()?.port ?? PORT });
});

// 이 도구 자신의 업데이트. 대상은 항상 SELF_PATH — 클라이언트가 경로를 못 정한다.
app.get('/api/update/check', async (req, res) => {
  try {
    res.json(await checkUpdate(SELF_PATH));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/update', async (req, res) => {
  try {
    res.json(await runUpdate(SELF_PATH));
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/shutdown', (req, res) => {
  res.json({ ok: true });
  console.log(`[shutdown] ${stamp()} 서버 종료 버튼으로 종료합니다`);
  // 응답 flush 후 종료
  setTimeout(() => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref(); // 강제 종료 안전망
  }, 50);
});

// 서버 콘솔 스트림: 연결하면 누적 로그 replay 후 실시간 로그를 받는다(읽기 전용).
function attachWebSocket(srv) {
  const wss = new WebSocketServer({ server: srv, path: '/ws/console' });
  wss.on('connection', (ws) => {
    const send = (text) => { if (ws.readyState === ws.OPEN) ws.send(text); };
    consoleStream.attach(send);
    idle.connected();
    ws.on('close', () => { consoleStream.detach(send); idle.disconnected(); });
  });
}

// 로그용 현지 시각 (서버가 왜·언제 꺼졌는지 server.log.prev 로 가리기 위해)
function stamp() {
  return new Date().toLocaleString('sv-SE');
}

// 종료 이유 기록: 신호로 죽으면 그 신호가 남는다. WSL VM 이 통째로 내려가면 아무 줄도 남지 않는다
// → 마지막 줄이 [idle]/[shutdown]/[signal] 중 무엇인지, 아예 없는지로 원인을 가린다.
for (const sig of ['SIGTERM', 'SIGHUP', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`[signal] ${stamp()} ${sig} 수신 — 종료합니다`);
    process.exit(0);
  });
}

// 브라우저 창(콘솔 WebSocket)이 모두 닫히고 유예가 지나면 자동 종료. AUTO_SHUTDOWN=0 으로 끔.
const AUTO_SHUTDOWN = process.env.AUTO_SHUTDOWN !== '0';
// 바로가기(launch.sh)로 띄우면 LAUNCHER_ORPHAN_MS 가 온다: 그 시간 안에 창이 한 번도 안 붙으면(주인 없는 서버) 종료.
// 터미널에서 npm start 로 직접 띄운 경우엔 없으므로 지금처럼 끄지 않는다.
const ORPHAN_MS = Number(process.env.LAUNCHER_ORPHAN_MS) || undefined;
const idle = createIdleShutdown({
  graceMs: 10000,
  startupGraceMs: ORPHAN_MS,
  onShutdown: (reason) => {
    if (!AUTO_SHUTDOWN) return;
    console.log(reason === 'orphan'
      ? `[idle] ${stamp()} 시작 후 ${Math.round(ORPHAN_MS / 1000)}초 동안 대시보드 창이 한 번도 안 붙어 서버를 종료합니다`
      : `[idle] ${stamp()} 대시보드 창이 닫혀 서버를 자동 종료합니다`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  },
});

// 포트가 사용 중이면 다음 포트로 폴백하며 바인딩한다.
function listen(port, triesLeft) {
  const srv = app.listen(port, '127.0.0.1');
  srv.once('listening', () => {
    server = srv;
    const actual = srv.address().port;
    console.log(`프로젝트 런처: http://127.0.0.1:${actual} (${stamp()} 시작)`);
    attachWebSocket(srv);
  });
  srv.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && triesLeft > 1) {
      console.warn(`[port] ${port} 사용 중 — ${port + 1} 시도`);
      listen(port + 1, triesLeft - 1);
    } else {
      console.error('[listen] 실패:', e.message);
      process.exit(1);
    }
  });
}

// 같은 런처가 이미 (폴백 포함) 다른 포트에서 떠 있으면 하나 더 띄우지 않는다
const running = await findRunningLauncher({ ports: Array.from({ length: MAX_PORT_TRIES }, (_, i) => PORT + i) });
if (running) {
  console.log(`[single] ${stamp()} 런처가 이미 http://127.0.0.1:${running} 에서 실행 중 — 이 서버는 띄우지 않고 종료합니다`);
  process.exit(0);
}
listen(PORT, MAX_PORT_TRIES);
