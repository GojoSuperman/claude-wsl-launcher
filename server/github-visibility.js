// server/github-visibility.js
// GitHub 저장소가 공개(PUBLIC)인지 비공개(PRIVATE)인지 gh CLI 로 조회. 결과는 TTL 캐시.
// gh 미설치/미로그인/네트워크 실패 → null (절대 throw 안 함). runner 주입으로 테스트 가능.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const TIMEOUT = 8000;

/** 기본 runner: gh repo view <owner/repo> --json visibility -q .visibility → 'PUBLIC'|'PRIVATE' */
async function defaultRunner(nameWithOwner) {
  const { stdout } = await execFileP('gh',
    ['repo', 'view', nameWithOwner, '--json', 'visibility', '-q', '.visibility'],
    { timeout: TIMEOUT, windowsHide: true });
  return stdout.trim();
}

/** owner/repo 형태 + 인자 악용('-' 시작) 차단. 순수. */
export function isValidNameWithOwner(s) {
  if (typeof s !== 'string' || s.startsWith('-')) return false;
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(s);
}

/** 'PUBLIC' | 'PRIVATE' | 'INTERNAL' 외의 값은 null 로 정규화. 순수. */
export function normalizeVisibility(raw) {
  const v = (raw || '').toString().trim().toUpperCase();
  return v === 'PUBLIC' || v === 'PRIVATE' || v === 'INTERNAL' ? v : null;
}

/**
 * 캐시 달린 조회기 생성. @param {object} [opts] runner / ttlMs / now 주입.
 * @returns {{ get(nameWithOwner:string): Promise<string|null>, size(): number }}
 */
export function createVisibilityLookup({ runner = defaultRunner, ttlMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const cache = new Map(); // nameWithOwner → { value, at }
  const inflight = new Map(); // 동시 요청 합치기
  async function get(nameWithOwner) {
    if (!isValidNameWithOwner(nameWithOwner)) return null;
    const hit = cache.get(nameWithOwner);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    if (inflight.has(nameWithOwner)) return inflight.get(nameWithOwner);
    const p = (async () => {
      let value = null;
      try { value = normalizeVisibility(await runner(nameWithOwner)); } catch { value = null; }
      // 실패(null)는 짧게만 캐시 → gh 로그인 직후 곧 반영되도록
      cache.set(nameWithOwner, { value, at: value === null ? now() - ttlMs + 30_000 : now() });
      inflight.delete(nameWithOwner);
      return value;
    })();
    inflight.set(nameWithOwner, p);
    return p;
  }
  return { get, size: () => cache.size };
}
