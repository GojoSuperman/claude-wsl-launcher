// test/git-sync.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetch as gitFetch, pull as gitPull } from '../server/git-sync.js';
import { aheadBehind } from '../server/git.js';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function git(dir, ...args) {
  execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
}
function bareRemote() {
  const bare = tmpDir('sbare-');
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
function commit(dir, file, msg) {
  fs.writeFileSync(path.join(dir, file), file);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', msg);
}

test('fetch: 원격에 새 커밋 → ok:true, 이후 behind:1', async () => {
  const bare = bareRemote();
  const c1 = cloneOf(bare, 'sf1-');
  commit(c1, 'a.txt', 'first');
  git(c1, 'push', '-q', '-u', 'origin', 'HEAD');
  const c2 = cloneOf(bare, 'sf2-');
  commit(c2, 'b.txt', 'second');
  git(c2, 'push', '-q', 'origin', 'HEAD');

  const r = await gitFetch(c1);
  assert.equal(r.ok, true);
  assert.deepEqual(await aheadBehind(c1), { ahead: 0, behind: 1 });
});

test('pull(ff): behind 상태 → ok:true, 이후 up-to-date', async () => {
  const bare = bareRemote();
  const c1 = cloneOf(bare, 'sp1-');
  commit(c1, 'a.txt', 'first');
  git(c1, 'push', '-q', '-u', 'origin', 'HEAD');
  const c2 = cloneOf(bare, 'sp2-');
  commit(c2, 'b.txt', 'second');
  git(c2, 'push', '-q', 'origin', 'HEAD');
  await gitFetch(c1);

  const r = await gitPull(c1);
  assert.equal(r.ok, true);
  assert.deepEqual(await aheadBehind(c1), { ahead: 0, behind: 0 });
});

test('pull(ff): 분기 상태 → ok:false (ff 불가)', async () => {
  const bare = bareRemote();
  const c1 = cloneOf(bare, 'spd1-');
  commit(c1, 'a.txt', 'first');
  git(c1, 'push', '-q', '-u', 'origin', 'HEAD');
  const c2 = cloneOf(bare, 'spd2-');
  commit(c2, 'b.txt', 'remote-change');
  git(c2, 'push', '-q', 'origin', 'HEAD');
  commit(c1, 'c.txt', 'local-change'); // 로컬도 다른 커밋 → 분기
  await gitFetch(c1);

  const r = await gitPull(c1);
  assert.equal(r.ok, false);
  assert.ok(typeof r.error === 'string' && r.error.length > 0);
});

test('fetch: 원격 없는 저장소 → ok:true (git 은 no-op 성공)', async () => {
  // git fetch 는 원격이 없어도 exit 0 (아무것도 안 함). 실사용에선 hasUpstream 가드로
  // 원격 있는 repo 에서만 호출되므로 이 무해한 no-op 성공이 올바른 계약이다.
  const dir = tmpDir('snr-');
  execFileSync('git', ['init', '-q', dir]);
  const r = await gitFetch(dir);
  assert.equal(r.ok, true);
});
