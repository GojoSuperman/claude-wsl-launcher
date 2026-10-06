// test/account-sync.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SHARED_ITEMS, ensureSharedLinks, syncSkills, mergeMcp, syncMcp, syncAccount } from '../server/account-sync.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'acct-sync-'));

test('ensureSharedLinks: 기본 계정에 있는 항목만 링크, 기존 실제 파일은 보존', () => {
  const root = tmp();
  const base = path.join(root, '.claude');
  const acct = path.join(root, '.claude-acct-2');
  fs.mkdirSync(path.join(base, 'projects'), { recursive: true });
  fs.writeFileSync(path.join(base, 'CLAUDE.md'), 'base');
  fs.mkdirSync(acct);
  fs.writeFileSync(path.join(acct, 'settings.json'), '{"mine":1}'); // 실제 파일 — 보존
  fs.writeFileSync(path.join(base, 'settings.json'), '{}');
  const r = ensureSharedLinks(base, acct);
  assert.deepEqual(r.added.sort(), ['CLAUDE.md', 'projects']);
  assert.equal(fs.readlinkSync(path.join(acct, 'projects')), path.join(base, 'projects'));
  assert.equal(fs.readFileSync(path.join(acct, 'settings.json'), 'utf8'), '{"mine":1}');
  assert.equal(fs.existsSync(path.join(acct, 'hooks')), false); // 기본에 없으면 안 만듦
  assert.deepEqual(ensureSharedLinks(base, acct).added, []); // 멱등
  assert.ok(SHARED_ITEMS.includes('commands') && SHARED_ITEMS.includes('agents'));
});

test('syncSkills: 없는 항목 링크, synced 제외, 실제 폴더 보존, 사라진 원본 링크 제거', () => {
  const root = tmp();
  const src = path.join(root, 'src');
  const dst = path.join(root, 'dst');
  fs.mkdirSync(path.join(src, 'a'), { recursive: true });
  fs.mkdirSync(path.join(src, 'gone'));
  fs.mkdirSync(path.join(src, 'synced'));
  fs.mkdirSync(path.join(dst, 'synced'), { recursive: true });
  assert.deepEqual(syncSkills(src, dst).added.sort(), ['a', 'gone']);
  assert.ok(!fs.lstatSync(path.join(dst, 'synced')).isSymbolicLink());
  fs.rmdirSync(path.join(src, 'gone'));
  assert.deepEqual(syncSkills(src, dst), { added: [], removed: ['gone'] });
});

test('mergeMcp: 사용자 스코프 교체, 프로젝트 스코프는 기본 쪽 있는 것만, 계정 정보 보존', () => {
  const base = { oauthAccount: { emailAddress: 'me' }, mcpServers: { seq: { command: 'x' } },
    projects: { '/p1': { mcpServers: { sb: { command: 'y' } } }, '/p2': { mcpServers: {} } } };
  const acct = { oauthAccount: { emailAddress: 'other' }, mcpServers: { old: {} }, projects: { '/p1': { foo: 1 } } };
  const { next, changed } = mergeMcp(base, acct);
  assert.equal(changed, true);
  assert.deepEqual(next.oauthAccount, { emailAddress: 'other' });
  assert.deepEqual(next.mcpServers, { seq: { command: 'x' } });
  assert.deepEqual(next.projects['/p1'], { foo: 1, mcpServers: { sb: { command: 'y' } } });
  assert.equal(next.projects['/p2'], undefined);
  assert.equal(mergeMcp(base, next).changed, false);
});

test('syncMcp: 계정 파일 없으면 건너뜀(로그인 전), 있으면 원자적 갱신', () => {
  const root = tmp();
  const bf = path.join(root, 'b.json');
  const af = path.join(root, 'a.json');
  fs.writeFileSync(bf, JSON.stringify({ mcpServers: { seq: {} } }));
  assert.equal(syncMcp(bf, af).changed, false);
  fs.writeFileSync(af, JSON.stringify({ userID: 'u' }));
  assert.equal(syncMcp(bf, af).changed, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(af, 'utf8')), { userID: 'u', mcpServers: { seq: {} } });
});

test('syncAccount: 링크+스킬+MCP 한 번에, 기본 계정 폴더 자체가 오면 아무것도 안 함', () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.claude', 'skills', 's1'), { recursive: true });
  fs.mkdirSync(path.join(home, '.claude', 'projects'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ mcpServers: { m: {} } }));
  const acct = path.join(home, '.claude-acct-2');
  fs.mkdirSync(acct);
  const r = syncAccount(home, acct);
  assert.deepEqual(r.links.added, ['projects']);
  assert.deepEqual(r.skills.added, ['s1']);
  assert.equal(r.mcp.changed, false); // 로그인 전이라 .claude.json 없음
  assert.deepEqual(syncAccount(home, path.join(home, '.claude')), { skipped: true });
  assert.deepEqual(syncAccount(home, path.join(home, '.claude') + '/'), { skipped: true });
  assert.equal(fs.existsSync(path.join(home, '.claude', 'projects', 'projects')), false);
});

test('syncAccount: 기본 계정 내부·홈 자체·기본 계정을 가리키는 링크 경로면 아무것도 안 함', () => {
  const home = tmp();
  const base = path.join(home, '.claude');
  fs.mkdirSync(path.join(base, 'projects'), { recursive: true });
  fs.writeFileSync(path.join(base, 'CLAUDE.md'), 'x');
  fs.symlinkSync(base, path.join(home, '.claude-alias'));
  assert.deepEqual(syncAccount(home, path.join(base, 'projects')), { skipped: true });
  assert.deepEqual(syncAccount(home, home), { skipped: true });
  assert.deepEqual(syncAccount(home, path.join(home, '.claude-alias')), { skipped: true });
  assert.equal(fs.existsSync(path.join(base, 'projects', 'projects')), false);
  assert.equal(fs.existsSync(path.join(home, 'CLAUDE.md')), false);
});
