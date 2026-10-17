// server/recent-launches.js
// 방금 claude 실행을 보낸 폴더 기억(메모리). 실행 버튼을 누른 뒤 claude 프로세스가 실제로 뜨기까지 몇 초가 걸려
// (터미널·WSL·nvm), 그 사이에 또 누르면 '실행 중' 판단(running.js)이 놓쳐 같은 대화를 두 창이 이어 열었다.
// → 실행 후 ttl 동안은 "켜는 중"으로 본다. 절대 throw 안 함, 시계 주입으로 테스트 가능.

export function createRecentLaunches({ ttlMs = 60_000, now = () => Date.now() } = {}) {
  const at = new Map(); // 폴더 경로 → 마지막 실행 시각
  return {
    mark(dir) { at.set(dir, now()); },
    isStarting(dir) {
      const t = at.get(dir);
      if (t === undefined) return false;
      if (now() - t < ttlMs) return true;
      at.delete(dir);
      return false;
    },
  };
}
