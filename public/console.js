// public/console.js
// 대시보드 서버의 콘솔(stdout/stderr)을 하단 드로어에 읽기 전용으로 보여준다.
// 목적: 서버가 살아있음을 눈에 보이게 해, 닫을 때 [서버 종료] 로 꺼야 함을 인지시킨다.
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

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/console`);
  ws.onmessage = (ev) => term.write(ev.data); // 서버 → 브라우저 (raw 텍스트)
  ws.onclose = () => term.write(`\r\n${t('consoleDisconnected')}\r\n`);
}

collapseBtn.addEventListener('click', () => {
  const collapsed = drawer.classList.toggle('collapsed');
  document.body.classList.toggle('drawer-collapsed', collapsed);
  if (!collapsed) fit.fit();
});

window.addEventListener('resize', () => fit.fit());

connect();
