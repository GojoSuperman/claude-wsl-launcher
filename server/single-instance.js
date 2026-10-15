// server/single-instance.js
// 같은 런처가 이미 다른 포트에서 떠 있는지 확인(서버 중복 방지).
// 서버는 포트가 쓰이고 있으면 다음 포트로 넘어가 뜨므로, 바로가기를 연달아 누르면 런처가 둘 뜰 수 있었다.
// → 시작 전에 범위 안 포트의 /api/health 마커를 보고, 이미 있으면 새 서버는 뜨지 않는다. 절대 throw 안 함.

const MARKER = 'claude-wsl-launcher';

// 그 포트에서 우리 런처가 답하는가 (남의 앱·빈 포트·느린 응답은 false)
async function defaultProbe(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    return (await res.json())?.app === MARKER;
  } catch {
    return false;
  }
}

/** ports 중 우리 런처가 답하는 첫 포트, 없으면 null. 포트들을 한꺼번에 조회한다. */
export async function findRunningLauncher({ ports, probe = defaultProbe }) {
  const hits = await Promise.all(ports.map(async (p) => { try { return await probe(p); } catch { return false; } }));
  const i = hits.indexOf(true);
  return i === -1 ? null : ports[i];
}
