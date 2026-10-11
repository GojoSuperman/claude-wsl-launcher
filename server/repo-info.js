// server/repo-info.js
// GitHub 저장소 정보(공개 여부·소유자·내 권한·협업자·기본 브랜치)를 gh GraphQL 1회로 조회. TTL 캐시.
// 기존 공개/비공개 조회(github-visibility.js 의 createVisibilityLookup)를 대체·확장한다.
// gh 미설치/미로그인/네트워크 실패 → null (절대 throw 안 함). runner 주입으로 테스트 가능.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isValidNameWithOwner } from './github-visibility.js';

const execFileP = promisify(execFile);
const TIMEOUT = 8000;

const FIELDS = 'visibility owner { login __typename } viewerPermission defaultBranchRef { name }';
const COLLAB = 'collaborators(affiliation: DIRECT, first: 50) { totalCount nodes { login } }';

/** gh api graphql 인자 (순수). owner·이름은 -f(문자열 그대로) — -F 는 숫자만인 이름(2048)을 정수로 바꿔 String! 과 안 맞음 */
export function graphqlArgs(nameWithOwner, withCollaborators) {
  const [o, n] = nameWithOwner.split('/');
  const query = `query($o:String!,$n:String!){repository(owner:$o,name:$n){${FIELDS} ${withCollaborators ? COLLAB : ''}}}`;
  return ['api', 'graphql', '-f', `query=${query}`, '-f', `o=${o}`, '-f', `n=${n}`];
}

async function defaultRunner(nameWithOwner, { withCollaborators }) {
  const { stdout } = await execFileP('gh', graphqlArgs(nameWithOwner, withCollaborators), { timeout: TIMEOUT, windowsHide: true });
  return JSON.parse(stdout);
}

/** GraphQL 응답 → 필요한 값 (순수). 저장소 없음 → null. */
export function parseRepoInfo(json) {
  const r = json?.data?.repository;
  if (!r || !r.owner) return null;
  const c = r.collaborators;
  return {
    visibility: r.visibility || null,
    owner: r.owner.login,
    ownerType: r.owner.__typename || null,
    permission: r.viewerPermission || null,
    collaborators: c ? c.totalCount : null,
    members: c ? (c.nodes || []).map((x) => x.login) : null,
    defaultBranch: r.defaultBranchRef ? r.defaultBranchRef.name : null,
  };
}

/** 캐시 달린 조회기. 협업자 조회가 실패(쓰기 권한 없음)하면 협업자 없이 1회 재조회. */
export function createRepoInfoLookup({ runner = defaultRunner, ttlMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const cache = new Map();
  const inflight = new Map();
  async function fetchOnce(name) {
    try {
      return parseRepoInfo(await runner(name, { withCollaborators: true }));
    } catch {
      try { return parseRepoInfo(await runner(name, { withCollaborators: false })); } catch { return null; }
    }
  }
  async function get(name) {
    if (!isValidNameWithOwner(name)) return null;
    const hit = cache.get(name);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    if (inflight.has(name)) return inflight.get(name);
    const p = (async () => {
      const value = await fetchOnce(name);
      // 실패(null)는 짧게만 캐시 → gh 로그인 직후 곧 반영
      cache.set(name, { value, at: value === null ? now() - ttlMs + 30_000 : now() });
      inflight.delete(name);
      return value;
    })();
    inflight.set(name, p);
    return p;
  }
  return { get, invalidate: (name) => cache.delete(name) };
}

async function defaultMeRunner() {
  const { stdout } = await execFileP('gh', ['api', 'user', '-q', '.login'], { timeout: TIMEOUT, windowsHide: true });
  return stdout.trim();
}

/** 내 GitHub 아이디. 성공하면 계속 기억, 실패하면 30초 뒤 재시도. */
export function createMeLookup({ runner = defaultMeRunner, now = () => Date.now() } = {}) {
  let value = null;
  let failedAt = -Infinity;
  let inflight = null;
  async function get() {
    if (value) return value;
    if (now() - failedAt < 30_000) return null;
    if (inflight) return inflight;
    inflight = (async () => {
      try { value = (await runner()) || null; } catch { value = null; }
      if (!value) failedAt = now();
      inflight = null;
      return value;
    })();
    return inflight;
  }
  return { get };
}
