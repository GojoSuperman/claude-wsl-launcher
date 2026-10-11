// test/folders.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listDir, windowsHomes, windowsPlaces } from '../server/folders.js';

function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-'));
  const mk = (p) => fs.mkdirSync(path.join(home, p), { recursive: true });
  mk('dev/a/.git'); mk('dev/b/.git'); mk('dev/c'); mk('work/x/.git'); mk('projects');
  mk('.hidden/h/.git'); mk('dev/a/node_modules/m/.git'); mk('single/.git');
  fs.writeFileSync(path.join(home, 'dev', 'file.txt'), '');
  return home;
}

test('listDir: 하위 폴더만, 숨김·node_modules 제외, 저장소 여부·개수', () => {
  const home = fakeHome();
  const r = listDir(path.join(home, 'dev'));
  assert.equal(r.ok, true);
  assert.equal(r.parent, home);
  assert.deepEqual(r.entries.map((e) => [e.name, e.isRepo, e.repos]), [['a', true, 0], ['b', true, 0], ['c', false, 0]]);
  const top = listDir(home);
  assert.deepEqual(top.entries.map((e) => [e.name, e.repos]), [['dev', 2], ['projects', 0], ['single', 0], ['work', 1]]);
});

test('listDir: 루트의 parent 는 null, 상대경로/없음/파일은 오류', () => {
  assert.equal(listDir('/').parent, null);
  assert.equal(listDir('relative').error, 'not absolute');
  assert.equal(listDir('/definitely/not/here').error, 'not found');
  const home = fakeHome();
  assert.equal(listDir(path.join(home, 'dev', 'file.txt')).error, 'not a directory');
});

test('windowsHomes: 시스템 계정 폴더·파일은 빼고 실제 사용자 폴더만', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wusers-'));
  for (const n of ['All Users', 'Default', 'Default User', 'Public', 'defaultuser100000', 'defaultuser100000.PC.000', 'carol', 'Bob']) {
    fs.mkdirSync(path.join(base, n));
  }
  fs.writeFileSync(path.join(base, 'desktop.ini'), '');
  assert.deepEqual(windowsHomes(base), [path.join(base, 'Bob'), path.join(base, 'carol')]);
  assert.deepEqual(windowsHomes(path.join(base, 'nope')), []);
});

test('windowsPlaces: 사용자별 바탕 화면·문서·다운로드(OneDrive 우선) + 드라이브', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wplace-'));
  const mk = (p) => fs.mkdirSync(path.join(root, p), { recursive: true });
  mk('Users/carol/OneDrive/Desktop'); mk('Users/carol/OneDrive/문서'); mk('Users/carol/Downloads'); mk('Users/carol/Documents');
  mk('Users/Public/Desktop');
  mk('c'); mk('d'); mk('wsl'); mk('wslg');
  fs.writeFileSync(path.join(root, 'e'), '');
  const u = path.join(root, 'Users', 'carol');
  const r = windowsPlaces({ usersBase: path.join(root, 'Users'), mntBase: root });
  assert.deepEqual(r.favorites, [
    { kind: 'desktop', path: path.join(u, 'OneDrive', 'Desktop') },
    { kind: 'downloads', path: path.join(u, 'Downloads') },
    { kind: 'documents', path: path.join(u, 'OneDrive', '문서') },
    { kind: 'home', path: u },
  ]);
  assert.deepEqual(r.drives, [{ letter: 'C', path: path.join(root, 'c') }, { letter: 'D', path: path.join(root, 'd') }]);
  assert.deepEqual(windowsPlaces({ usersBase: path.join(root, 'nope'), mntBase: path.join(root, 'nope') }), { favorites: [], drives: [] });
});
