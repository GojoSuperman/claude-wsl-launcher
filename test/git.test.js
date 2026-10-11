// test/git.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { status, aheadBehind, parseOriginRepo, defaultBranch, aheadBehindRef, localGithubUser } from '../server/git.js';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function git(dir, ...args) {
  execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
}
function initRepo(dir) {
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'commit.gpgsign', 'false');
}
function commit(dir, file, msg) {
  fs.writeFileSync(path.join(dir, file), 'x');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', msg);
}

test('비-git 폴더 → isGit:false, 나머지 null', async () => {
  const d = tmpDir('nongit-');
  const s = await status(d);
  assert.deepEqual(s, { isGit: false, branch: null, dirty: null, lastCommitISO: null, hasUpstream: false });
});

test('커밋 있는 깨끗한 repo → isGit:true, branch, dirty:false, ISO 시각', async () => {
  const d = tmpDir('clean-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  const s = await status(d);
  assert.equal(s.isGit, true);
  assert.equal(typeof s.branch, 'string');
  assert.ok(s.branch.length > 0);
  assert.equal(s.dirty, false);
  assert.match(s.lastCommitISO, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('미커밋 변경 있으면 dirty:true', async () => {
  const d = tmpDir('dirty-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  fs.writeFileSync(path.join(d, 'b.txt'), 'new'); // untracked → dirty
  const s = await status(d);
  assert.equal(s.dirty, true);
});

test('커밋 0개 repo → isGit:true, lastCommitISO:null', async () => {
  const d = tmpDir('empty-');
  initRepo(d);
  const s = await status(d);
  assert.equal(s.isGit, true);
  assert.equal(s.lastCommitISO, null);
});

test('브랜치명 반영', async () => {
  const d = tmpDir('branch-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  git(d, 'checkout', '-q', '-b', 'feature-x');
  const s = await status(d);
  assert.equal(s.branch, 'feature-x');
});

test('detached HEAD → branch:"HEAD"', async () => {
  const d = tmpDir('detached-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  const sha = execFileSync('git', ['-C', d, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  git(d, 'checkout', '-q', '--detach', sha);
  const s = await status(d);
  assert.equal(s.branch, 'HEAD'); // git 의 실제 동작 문서화
});

// --- 원격(로컬 bare) 셋업 헬퍼 ---
function bareRemote() {
  const bare = tmpDir('bare-');
  git(bare, 'init', '-q', '--bare');
  return bare;
}
function cloneOf(bare, prefix) {
  const dir = tmpDir(prefix);
  execFileSync('git', ['clone', '-q', bare, dir], { stdio: 'ignore' });
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'commit.gpgsign', 'false');
  return dir;
}

test('hasUpstream: 업스트림 추적 clone → true', async () => {
  const bare = bareRemote();
  const c = cloneOf(bare, 'up-');
  commit(c, 'a.txt', 'first');
  git(c, 'push', '-q', '-u', 'origin', 'HEAD');
  const s = await status(c);
  assert.equal(s.hasUpstream, true);
});

test('hasUpstream: 단독 repo → false', async () => {
  const d = tmpDir('noup-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  const s = await status(d);
  assert.equal(s.hasUpstream, false);
});

test('hasUpstream: 비-git → false', async () => {
  const d = tmpDir('noup2-');
  const s = await status(d);
  assert.equal(s.hasUpstream, false);
});

test('aheadBehind: 분기 없음 → {0,0}', async () => {
  const bare = bareRemote();
  const c = cloneOf(bare, 'ab0-');
  commit(c, 'a.txt', 'first');
  git(c, 'push', '-q', '-u', 'origin', 'HEAD');
  assert.deepEqual(await aheadBehind(c), { ahead: 0, behind: 0 });
});

test('aheadBehind: 로컬 1커밋 앞섬 → ahead:1', async () => {
  const bare = bareRemote();
  const c = cloneOf(bare, 'ab1-');
  commit(c, 'a.txt', 'first');
  git(c, 'push', '-q', '-u', 'origin', 'HEAD');
  commit(c, 'b.txt', 'second'); // not pushed
  assert.deepEqual(await aheadBehind(c), { ahead: 1, behind: 0 });
});

test('aheadBehind: 원격이 앞섬 → behind:1 (fetch 후)', async () => {
  const bare = bareRemote();
  const c1 = cloneOf(bare, 'abh1-');
  commit(c1, 'a.txt', 'first');
  git(c1, 'push', '-q', '-u', 'origin', 'HEAD');
  const c2 = cloneOf(bare, 'abh2-');
  commit(c2, 'b.txt', 'second');
  git(c2, 'push', '-q', 'origin', 'HEAD');
  git(c1, 'fetch', '-q');
  assert.deepEqual(await aheadBehind(c1), { ahead: 0, behind: 1 });
});

test('aheadBehind: 업스트림 없으면 {0,0}', async () => {
  const d = tmpDir('abnoup-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  assert.deepEqual(await aheadBehind(d), { ahead: 0, behind: 0 });
});

test('parseOriginRepo: https/ssh/.git/non-github/빈값', () => {
  assert.equal(parseOriginRepo('git@github.com:owner/repo.git'), 'owner/repo');
  assert.equal(parseOriginRepo('https://github.com/owner/repo.git'), 'owner/repo');
  assert.equal(parseOriginRepo('https://github.com/owner/repo'), 'owner/repo');
  assert.equal(parseOriginRepo('https://github.com/owner/repo/'), 'owner/repo');
  assert.equal(parseOriginRepo('ssh://git@github.com/owner/repo.git'), 'owner/repo');
  assert.equal(parseOriginRepo('https://gitlab.com/owner/repo.git'), null);
  assert.equal(parseOriginRepo(''), null);
  assert.equal(parseOriginRepo(null), null);
});

test('커밋 0개 repo → branch 는 HEAD 가 아니라 실제 이름', async () => {
  const d = tmpDir('unborn-');
  initRepo(d);
  git(d, 'checkout', '-q', '-b', 'main');
  assert.equal((await status(d)).branch, 'main');
});

test('도구 폴더(.bkit/, .superpowers/)만 미추적 → dirty:false, 다른 파일 섞이면 true', async () => {
  const d = tmpDir('tooldir-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  fs.mkdirSync(path.join(d, '.bkit'));
  fs.writeFileSync(path.join(d, '.bkit', 'state.json'), '{}');
  fs.mkdirSync(path.join(d, '.superpowers'));
  fs.writeFileSync(path.join(d, '.superpowers', 'x.md'), 'x');
  assert.equal((await status(d)).dirty, false);
  fs.writeFileSync(path.join(d, 'new.txt'), 'x');
  assert.equal((await status(d)).dirty, true);
});

test('defaultBranch / aheadBehindRef: clone 은 origin/HEAD 로 기본 브랜치, 슬래시 브랜치도 비교', async () => {
  const bare = bareRemote();
  const seed = cloneOf(bare, 'seed-');
  commit(seed, 'a.txt', 'first');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
  git(bare, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const c = tmpDir('clone2-');
  execFileSync('git', ['clone', '-q', bare, c], { stdio: 'ignore' });
  git(c, 'config', 'user.email', 't@t'); git(c, 'config', 'user.name', 't'); git(c, 'config', 'commit.gpgsign', 'false');
  assert.equal(await defaultBranch(c), 'main');
  git(c, 'checkout', '-q', '-b', 'hackathon2/participant-04');
  commit(c, 'b.txt', 'mine');
  commit(seed, 'c.txt', 'theirs');
  git(seed, 'push', '-q', 'origin', 'HEAD:main');
  git(c, 'fetch', '-q');
  assert.deepEqual(await aheadBehindRef(c, 'origin/main'), { ahead: 1, behind: 1 });
  assert.equal(await aheadBehindRef(c, 'origin/nope'), null);
});

test('defaultBranch: origin/HEAD 없으면 null', async () => {
  const d = tmpDir('noorigin-');
  initRepo(d);
  commit(d, 'a.txt', 'first');
  assert.equal(await defaultBranch(d), null);
});

test('localGithubUser: 폴더의 github.user 설정(한 PC 에 GitHub 계정이 여럿일 때), 없으면 null', async () => {
  const d = tmpDir('ghuser-');
  initRepo(d);
  assert.equal(await localGithubUser(d), null);
  git(d, 'config', 'github.user', 'Bob');
  assert.equal(await localGithubUser(d), 'Bob');
});

test('localGithubUser: 전역(global) github.user 는 무시하고 이 폴더(local) 설정만', async () => {
  const d = tmpDir('ghuser-g-');
  initRepo(d);
  const gcfg = path.join(tmpDir('gcfg-'), 'gitconfig');
  fs.writeFileSync(gcfg, '[github]\n\tuser = old-global-id\n');
  const prev = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = gcfg;
  try {
    assert.equal(await localGithubUser(d), null);
    git(d, 'config', '--local', 'github.user', 'Bob');
    assert.equal(await localGithubUser(d), 'Bob');
  } finally {
    if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = prev;
  }
});
