// server/pr-status.js
// 팀 프로젝트 PR 상태: 이 브랜치의 PR(가장 최근 1개), 열린 PR 목록(팀장용). gh pr list 사용.
// 실패(gh 없음·미로그인·네트워크) → null. 절대 throw 안 함. runner 주입으로 테스트 가능.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const TIMEOUT = 10000;

async function defaultRunner(args) {
  const { stdout } = await execFileP('gh', args, { timeout: TIMEOUT, windowsHide: true });
  return JSON.parse(stdout);
}

/** 같은 브랜치의 PR 들 중 가장 최근(번호 큰) 1개 (순수) */
export function pickLatestPr(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const p = [...list].sort((a, b) => b.number - a.number)[0];
  return { number: p.number, state: p.state, mergeable: p.mergeable, title: p.title, url: p.url, author: p.author?.login ?? null };
}

export async function prForBranch(repo, branch, runner = defaultRunner) {
  if (!repo || !branch) return null;
  try {
    return pickLatestPr(await runner(['pr', 'list', '-R', repo, '--head', branch, '--state', 'all',
      '--json', 'number,state,mergeable,title,url,author', '-L', '10']));
  } catch {
    return null;
  }
}

export async function openPrs(repo, runner = defaultRunner) {
  if (!repo) return null;
  try {
    const list = await runner(['pr', 'list', '-R', repo, '--state', 'open', '--json', 'number,title,url,author,isDraft', '-L', '50']);
    return list.map((p) => ({ number: p.number, title: p.title, url: p.url, author: p.author?.login ?? null, isDraft: !!p.isDraft }));
  } catch {
    return null;
  }
}
