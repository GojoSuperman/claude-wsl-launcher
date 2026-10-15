// public/single-window.js
// 대시보드 창은 하나만: 바로가기를 또 눌러 새 창이 열리면, 먼저 열려 있던 창은 스스로 닫는다.
// 같은 주소(같은 서버)의 창끼리 BroadcastChannel 로 "새 창이 열렸다"를 알린다(자기 자신에겐 안 옴 → 새로고침은 무관).
// 브라우저가 스크립트로 창 닫기를 막으면 "다른 창에서 열렸어요" 안내로 덮어 헷갈리지 않게 한다.
import { t } from './i18n.js';

if ('BroadcastChannel' in window) {
  const ch = new BroadcastChannel('claude-wsl-launcher-window');
  ch.onmessage = (e) => {
    if (e.data?.type !== 'opened') return;
    ch.close(); // 이 창은 물러난다 — 이후 새 창들 소식은 받지 않음
    window.close();
    setTimeout(showReplaced, 300); // 닫히지 않았으면 안내로 덮는다
  };
  ch.postMessage({ type: 'opened' });
}

function showReplaced() {
  if (document.getElementById('window-replaced')) return;
  const el = document.createElement('div');
  el.id = 'window-replaced';
  el.className = 'help-modal';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = '<div class="help-dialog window-replaced-box"><h2></h2><p></p><button type="button"></button></div>';
  el.querySelector('h2').textContent = t('windowReplacedTitle');
  el.querySelector('p').textContent = t('windowReplacedBody');
  const b = el.querySelector('button');
  b.textContent = t('windowReplacedClose');
  b.addEventListener('click', () => window.close());
  document.body.appendChild(el);
}
