// test/accounts.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_ID, normalizeAccounts, readAccounts, writeAccounts, readEmail, listAccounts, accountLabel,
  addAccount, setAlias, removeAccount, resolveLaunchAccount, rememberLast, renameInAccounts,
} from '../server/accounts.js';

function setup() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'accounts-'));
  fs.mkdirSync(path.join(home, '.claude', 'projects'), { recursive: true });
  fs.mkdirSync(path.join(home, '.claude', 'skills', 'sk'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'x');
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'me@x.com' } }));
  const file = path.join(home, 'state', 'project-launcher', 'accounts.json');
  return { home, file };
}

test('readAccounts: 없음/깨짐 → 빈 상태', () => {
  const { file } = setup();
  assert.deepEqual(readAccounts(file), { defaultAlias: '', accounts: [], lastByProject: {} });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{oops');
  assert.deepEqual(readAccounts(file).accounts, []);
});

test('normalizeAccounts: 중복 id·상대경로·default id·없는 id 를 가리키는 기억은 버림', () => {
  const s = normalizeAccounts({
    defaultAlias: ' 개인 ',
    accounts: [
      { id: 'a2', dir: '/h/.claude-acct-2', alias: ' 수업 ' },
      { id: 'a2', dir: '/h/.claude-acct-9' },
      { id: 'a3', dir: 'relative/dir' },
      { id: 'default', dir: '/h/.claude' },
    ],
    lastByProject: { p1: 'a2', p2: 'gone', p3: 'default' },
  });
  assert.equal(s.defaultAlias, '개인');
  assert.deepEqual(s.accounts, [{ id: 'a2', dir: '/h/.claude-acct-2', alias: '수업' }]);
  assert.deepEqual(s.lastByProject, { p1: 'a2' });
});

test('readEmail: oauthAccount.emailAddress, 없으면 빈 문자열', () => {
  const { home } = setup();
  assert.equal(readEmail(path.join(home, '.claude.json')), 'me@x.com');
  assert.equal(readEmail(path.join(home, 'nope.json')), '');
});

test('addAccount: ~/.claude-acct-2 생성, 공유 링크·스킬 링크, 목록 등록', () => {
  const { home, file } = setup();
  const r = addAccount(home, file);
  assert.equal(r.ok, true);
  assert.deepEqual(r.account, { id: 'a2', dir: path.join(home, '.claude-acct-2'), alias: '' });
  assert.equal(fs.readlinkSync(path.join(home, '.claude-acct-2', 'projects')), path.join(home, '.claude', 'projects'));
  assert.ok(fs.lstatSync(path.join(home, '.claude-acct-2', 'skills', 'sk')).isSymbolicLink());
  assert.deepEqual(readAccounts(file).accounts.map((a) => a.id), ['a2']);
});

test('addAccount: 목록에 없는 기존 -2 폴더는 건너뛰고 손대지 않음 → -3', () => {
  const { home, file } = setup();
  fs.mkdirSync(path.join(home, '.claude-acct-2'));
  fs.writeFileSync(path.join(home, '.claude-acct-2', 'keep.txt'), 'old');
  const r = addAccount(home, file);
  assert.equal(r.account.id, 'a3');
  assert.equal(fs.readFileSync(path.join(home, '.claude-acct-2', 'keep.txt'), 'utf8'), 'old');
});

test('addAccount: 링크 생성 실패 시 새 폴더만 되돌리고 미등록, 기본 계정은 그대로', () => {
  const { home, file } = setup();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const orig = fs.symlinkSync;
  fs.symlinkSync = () => { throw new Error('EPERM test'); };
  try {
    const r = addAccount(home, file);
    assert.equal(r.ok, false);
    assert.match(r.error, /EPERM test/);
  } finally {
    fs.symlinkSync = orig;
  }
  assert.equal(fs.existsSync(path.join(home, '.claude-acct-2')), false);
  assert.deepEqual(readAccounts(file).accounts, []);
  assert.ok(fs.existsSync(path.join(home, '.claude', 'projects')));
});

test('listAccounts/accountLabel: 기본 먼저, 이메일·로그인 여부·폴더 존재', () => {
  const { home, file } = setup();
  addAccount(home, file);
  setAlias(file, 'a2', '수업용');
  let list = listAccounts(home, readAccounts(file));
  assert.equal(list[0].id, DEFAULT_ID);
  assert.equal(list[0].email, 'me@x.com');
  assert.equal(list[1].loggedIn, false);
  assert.equal(accountLabel(list[1]), '수업용');
  fs.writeFileSync(path.join(home, '.claude-acct-2', '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'other@x.com' } }));
  list = listAccounts(home, readAccounts(file));
  assert.equal(list[1].email, 'other@x.com');
  assert.equal(list[1].exists, true);
  setAlias(file, 'a2', '');
  assert.equal(accountLabel(listAccounts(home, readAccounts(file))[1]), 'other@x.com');
});

test('setAlias: 기본 계정은 defaultAlias, 없는 id 는 거절, 40자 제한', () => {
  const { home, file } = setup();
  addAccount(home, file);
  setAlias(file, DEFAULT_ID, ' 개인 ');
  assert.equal(readAccounts(file).defaultAlias, '개인');
  assert.equal(setAlias(file, 'nope', 'x').ok, false);
  setAlias(file, 'a2', 'x'.repeat(60));
  assert.equal(readAccounts(file).accounts[0].alias.length, 40);
});

test('removeAccount: 목록에서만 제거(폴더 보존), 기억한 프로젝트는 기본으로, 기본은 불가', () => {
  const { home, file } = setup();
  addAccount(home, file);
  rememberLast(file, 'p1', 'a2');
  const r = removeAccount(file, 'a2');
  assert.deepEqual(r, { ok: true, dir: path.join(home, '.claude-acct-2') });
  assert.ok(fs.existsSync(path.join(home, '.claude-acct-2')));
  assert.deepEqual(readAccounts(file).lastByProject, {});
  assert.equal(removeAccount(file, DEFAULT_ID).ok, false);
});

test('resolveLaunchAccount: 생략→기억(없으면 기본), 지정→검증', () => {
  const s = normalizeAccounts({ accounts: [{ id: 'a2', dir: '/h/.claude-acct-2' }], lastByProject: { p1: 'a2' } });
  assert.deepEqual(resolveLaunchAccount(s, 'p1'), { id: 'a2' });
  assert.deepEqual(resolveLaunchAccount(s, 'p2'), { id: DEFAULT_ID });
  assert.deepEqual(resolveLaunchAccount(s, 'p1', DEFAULT_ID), { id: DEFAULT_ID });
  assert.deepEqual(resolveLaunchAccount(s, 'p1', 'zz'), { error: 'unknown account' });
});

test('rememberLast/renameInAccounts: 기본 선택은 기억 삭제, 이름 변경 시 이동', () => {
  const { home, file } = setup();
  addAccount(home, file);
  rememberLast(file, 'p1', 'a2');
  renameInAccounts(file, 'p1', 'p1-new');
  assert.deepEqual(readAccounts(file).lastByProject, { 'p1-new': 'a2' });
  rememberLast(file, 'p1-new', DEFAULT_ID);
  assert.deepEqual(readAccounts(file).lastByProject, {});
});

test('normalizeAccounts: 계정 폴더는 ".claude-이름" 형식만 — ~/.claude 내부·홈·루트·cmd 특수문자 경로는 버림', () => {
  const s = normalizeAccounts({ accounts: [
    { id: 'a1', dir: '/h/.claude-work' },
    { id: 'b1', dir: '/h/.claude/projects' },
    { id: 'b2', dir: '/h' },
    { id: 'b3', dir: '/' },
    { id: 'b4', dir: '/tmp/a&calc/.claude-x' },
    { id: 'b5', dir: '/h/.claude-acct-2/../.claude' },
    { id: 'b6', dir: '/h/.claude' },
  ] });
  assert.deepEqual(s.accounts.map((a) => a.id), ['a1']);
});

test('writeAccounts: 기존 파일이 깨져 있으면 덮어쓰기 전에 .bad-<시각> 으로 보존', () => {
  const { file } = setup();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{"accounts":[{"id":"a1","dir":"/h/.claude-work"},]}'); // 쉼표 오타
  rememberLast(file, 'p1', DEFAULT_ID);
  const bad = fs.readdirSync(path.dirname(file)).filter((n) => n.startsWith('accounts.json.bad-'));
  assert.equal(bad.length, 1);
  assert.match(fs.readFileSync(path.join(path.dirname(file), bad[0]), 'utf8'), /claude-work/);
  assert.deepEqual(readAccounts(file).accounts, []); // 새 파일은 정상 JSON
  rememberLast(file, 'p1', DEFAULT_ID); // 이번엔 정상 파일이라 추가 백업 없음
  assert.equal(fs.readdirSync(path.dirname(file)).filter((n) => n.startsWith('accounts.json.bad-')).length, 1);
});
