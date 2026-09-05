// server/index.js
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectEnv } from './env.js';
import { list } from './scanner.js';
import { hasSession } from './session.js';
import { resolveProject } from './paths.js';
import { launch } from './launcher.js';
import { status as gitStatus, aheadBehind, originRepo } from './git.js';
import { createVisibilityLookup } from './github-visibility.js';
import { fetch as gitFetch, pull as gitPull } from './git-sync.js';
import { runningPaths, isRunning } from './running.js';
import { create as createProject } from './creator.js';
import { rename as renameProject } from './renamer.js';
import { createConsoleStream } from './console-stream.js';
import { createIdleShutdown } from './idle-shutdown.js';

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
console.log(`[env] distro=${env.distro} projectsRoot=${env.projectsRoot}`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/xterm', express.static(path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm')));
app.use('/vendor/addon-fit', express.static(path.join(__dirname, '..', 'node_modules', '@xterm', 'addon-fit')));

app.get('/api/projects', async (req, res) => {
  try {
    const dirs = list(env.projectsRoot);
    const runSet = runningPaths();
    const projects = await Promise.all(
      dirs.map(async (p) => ({
        name: p.name,
        path: p.path,
        hasSession: hasSession(env.home, p.path),
        git: await gitStatus(p.path),
        running: isRunning(runSet, p.path),
        self: isSelf(p.path),
        github: await originRepo(p.path), // origin 이 GitHub 면 'owner/repo', 아니면 null
      }))
    );
    res.json({ projects });
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
  const cont = hasSession(env.home, full);
  try {
    await launch(env.distro, full, cont);
    res.json({ ok: true, continued: cont });
  } catch (e) {
    res.status(500).json({ ok: false, error: `launch failed: ${e.message}` });
  }
});

app.post('/api/git/fetch', async (req, res) => {
  try {
    const full = resolveProject(env.projectsRoot, req.body?.name);
    if (!full) return res.status(400).json({ ok: false, error: 'unknown project' });
    const r = await gitFetch(full);
    if (!r.ok) return res.json({ ok: false, error: r.error });
    const ab = await aheadBehind(full);
    res.json({ ok: true, ahead: ab.ahead, behind: ab.behind });
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
const visibility = createVisibilityLookup();
app.post('/api/github/visibility', async (req, res) => {
  try {
    const names = Array.isArray(req.body?.names) ? req.body.names.slice(0, 200) : [];
    const out = {};
    // 동시 4개씩 — gh 호출 폭주 방지
    const queue = [...names];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const name = queue.shift();
        const full = resolveProject(env.projectsRoot, name);
        if (!full) { out[name] = null; continue; }
        const repo = await originRepo(full);
        out[name] = repo ? await visibility.get(repo) : null;
      }
    }));
    res.json({ ok: true, visibility: out });
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

app.post('/api/projects/rename', async (req, res) => {
  try {
    const runSet = runningPaths();
    const r = await renameProject({
      projectsRoot: env.projectsRoot,
      home: env.home,
      name: req.body?.name,
      newName: req.body?.newName,
      isRunning: (full) => isRunning(runSet, full),
      isSelf,
    });
    res.json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// launcher 가 "이게 우리 대시보드인가"를 식별하는 마커. 실제 바인딩 포트도 알려준다.
app.get('/api/health', (req, res) => {
  res.json({ app: 'claude-wsl-launcher', port: server?.address()?.port ?? PORT });
});

app.post('/api/shutdown', (req, res) => {
  res.json({ ok: true });
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

// 브라우저 창(콘솔 WebSocket)이 모두 닫히고 유예가 지나면 자동 종료. AUTO_SHUTDOWN=0 으로 끔.
const AUTO_SHUTDOWN = process.env.AUTO_SHUTDOWN !== '0';
const idle = createIdleShutdown({
  graceMs: 10000,
  onShutdown: () => {
    if (!AUTO_SHUTDOWN) return;
    console.log('[idle] 대시보드 창이 닫혀 서버를 자동 종료합니다');
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
    console.log(`프로젝트 런처: http://127.0.0.1:${actual}`);
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

listen(PORT, MAX_PORT_TRIES);
