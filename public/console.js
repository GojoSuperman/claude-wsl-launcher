// public/console.js
// 대시보드 서버의 콘솔(stdout/stderr)을 하단 드로어에 읽기 전용으로 보여준다.
// 목적: 서버가 살아있음을 눈에 보이게 한다. 이 WebSocket 이 모두 끊기면 서버가 유예 후 자동 종료된다(idle-shutdown).
import { t } from './i18n.js';

const XTerm = window.Terminal;
const FitAddon = window.FitAddon.FitAddon;

const drawer = document.getElementById('console-drawer');
const paneEl = document.getElementById('console-pane');
const collapseBtn = document.getElementById('console-collapse');
const titleEl = document.getElementById('console-title');

document.body.classList.add('drawer-open'); // 드로어는 항상 표시(서버 상태 상시 노출)

// 타이틀: 번역된 라벨 + 실제 접속 호스트(포트 하드코딩 제거).
function setTitle() {
  titleEl.textContent = `● ${t('consoleTitle')} · ${location.host}`;
}
setTitle();
window.addEventListener('i18n:change', setTitle);

const term = new XTerm({ convertEol: true, fontSize: 13, cursorBlink: false, disableStdin: true });
const fit = new FitAddon();
term.loadAddon(fit);
term.open(paneEl);
fit.fit();

// 끊기면 1초마다 다시 연결한다. 서버는 연결이 0개인 채 10초가 지나면 자동 종료되므로,
// 절전에서 깨어날 때처럼 창은 열려 있는데 연결만 끊긴 경우 그 안에 다시 붙어야 서버가 산다(2026-10-01 실측).
// 15번(≈15초, 서버 유예 10초보다 김) 연달아 실패하면 서버가 꺼진 것으로 보고 안내를 한 번 띄운다.
const RETRY_MS = 1000;
const GONE_AFTER = 15;
let failures = 0;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/console`);
  ws.onopen = () => {
    // 서버가 접속 시 누적 로그를 처음부터 다시 보내므로, 재연결이면 화면을 비워 중복을 막는다.
    if (failures > 0) term.reset();
    failures = 0;
  };
  ws.onmessage = (ev) => term.write(ev.data); // 서버 → 브라우저 (raw 텍스트)
  ws.onclose = () => {
    if (failures === 0) term.write(`\r\n${t('consoleDisconnected')}\r\n`);
    failures += 1;
    if (failures === GONE_AFTER) term.write(`${t('consoleServerGone')}\r\n`);
    setTimeout(connect, RETRY_MS);
  };
}

collapseBtn.addEventListener('click', () => {
  const collapsed = drawer.classList.toggle('collapsed');
  document.body.classList.toggle('drawer-collapsed', collapsed);
  if (!collapsed) fit.fit();
});

window.addEventListener('resize', () => fit.fit());

connect();
