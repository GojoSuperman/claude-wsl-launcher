// test/importer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { importFolder, importMode, inspectImport, fixCrlfOnly } from '../server/importer.js';
import { encode } from '../server/session.js';

// home/projects(가져올 곳) + home/dev/<name>(가져올 폴더, git 저장소 + 세션 이력)
function setup(name = 'app', { session = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ihome-'));
  const projectsRoot = path.join(home, 'projects');
  fs.mkdirSync(projectsRoot);
  const src = path.join(home, 'dev', name);
  fs.mkdirSync(path.join(src, 'node_modules', 'pkg'), { recursive: true });
  fs.writeFileSync(path.join(src, 'node_modules', 'pkg', 'index.js'), '');
  fs.mkdirSync(path.join(src, 'lib', 'node_modules'), { recursive: true }); // 깊은 node_modules 도 제외
  fs.writeFileSync(path.join(src, 'README.md'), '# hi\n');
  execFileSync('git', ['-C', src, 'init', '-q']);
  if (session) {
    const sdir = path.join(home, '.claude', 'projects', encode(src));
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, 'abc.jsonl'), '{}\n');
  }
  return { home, projectsRoot, src };
}
const sessDir = (home, p) => path.join(home, '.claude', 'projects', encode(p));

test('importMode: /mnt/<드라이브>/ 는 복사, 그 밖(WSL)은 이동', () => {
  assert.equal(importMode('/mnt/c/Users/g/app'), 'copy');
  assert.equal(importMode('/mnt/D/work/app'), 'copy');
  assert.equal(importMode('/home/g/dev/app'), 'move');
  assert.equal(importMode('/mnt/wsl/x'), 'move'); // 드라이브 문자 아님
});

test('WSL 폴더 → ~/projects 로 이동 + 세션 이력 이동', async () => {
  const { home, projectsRoot, src } = setup('app', { session: true });
  const r = await importFolder({ projectsRoot, home, src });
  const target = path.join(projectsRoot, 'app');
  assert.deepEqual(r, { ok: true, name: 'app', path: target, mode: 'move' });
  assert.equal(fs.existsSync(src), false);
  assert.ok(fs.existsSync(path.join(target, '.git')));
  assert.ok(fs.existsSync(path.join(target, 'node_modules')), '이동은 통째로(node_modules 포함)');
  assert.ok(fs.existsSync(path.join(sessDir(home, target), 'abc.jsonl')));
  assert.equal(fs.existsSync(sessDir(home, src)), false);
});

test('Windows 폴더 → 복사(원본 유지, node_modules 제외) + 세션 이력 복사', async () => {
  const { home, projectsRoot, src } = setup('app', { session: true });
  const r = await importFolder({ projectsRoot, home, src, isWindows: () => true });
  const target = path.join(projectsRoot, 'app');
  assert.deepEqual(r, { ok: true, name: 'app', path: target, mode: 'copy' });
  assert.ok(fs.existsSync(path.join(src, 'README.md')), '원본 유지');
  assert.equal(fs.readFileSync(path.join(target, 'README.md'), 'utf8'), '# hi\n');
  assert.ok(fs.existsSync(path.join(target, '.git', 'HEAD')));
  assert.equal(fs.existsSync(path.join(target, 'node_modules')), false);
  assert.equal(fs.existsSync(path.join(target, 'lib', 'node_modules')), false);
  assert.ok(fs.existsSync(path.join(sessDir(home, target), 'abc.jsonl')));
  assert.ok(fs.existsSync(path.join(sessDir(home, src), 'abc.jsonl')), '원본 이력도 유지');
});

test('새 이름을 주면 그 이름으로', async () => {
  const { home, projectsRoot, src } = setup('app');
  const r = await importFolder({ projectsRoot, home, src, name: 'app2' });
  assert.equal(r.ok, true);
  assert.equal(r.name, 'app2');
  assert.ok(fs.existsSync(path.join(projectsRoot, 'app2', '.git')));
});

test('같은 이름이 이미 있으면 거절(덮어쓰지 않음)', async () => {
  const { home, projectsRoot, src } = setup('app');
  fs.mkdirSync(path.join(projectsRoot, 'app'));
  const r = await importFolder({ projectsRoot, home, src });
  assert.deepEqual(r, { ok: false, error: 'already exists' });
  assert.ok(fs.existsSync(src));
});

test('잘못된 이름 거절', async () => {
  const { home, projectsRoot, src } = setup('app');
  assert.deepEqual(await importFolder({ projectsRoot, home, src, name: 'a/b' }), { ok: false, error: 'invalid name' });
});

test('없는 폴더·파일 거절', async () => {
  const { home, projectsRoot } = setup('app');
  assert.deepEqual(await importFolder({ projectsRoot, home, src: path.join(home, 'nope') }), { ok: false, error: 'not found' });
  const f = path.join(home, 'file.txt');
  fs.writeFileSync(f, '');
  assert.deepEqual(await importFolder({ projectsRoot, home, src: f }), { ok: false, error: 'not a directory' });
  assert.deepEqual(await importFolder({ projectsRoot, home, src: 'dev/app' }), { ok: false, error: 'not found' });
});

test('이미 ~/projects 안이거나, ~/projects·홈을 품은 폴더는 거절', async () => {
  const { home, projectsRoot } = setup('app');
  fs.mkdirSync(path.join(projectsRoot, 'x'));
  assert.deepEqual(await importFolder({ projectsRoot, home, src: projectsRoot }), { ok: false, error: 'inside projects' });
  assert.deepEqual(await importFolder({ projectsRoot, home, src: path.join(projectsRoot, 'x') }), { ok: false, error: 'inside projects' });
  assert.deepEqual(await importFolder({ projectsRoot, home, src: home }), { ok: false, error: 'too broad' });
  assert.deepEqual(await importFolder({ projectsRoot, home, src: path.dirname(home) }), { ok: false, error: 'too broad' });
  assert.deepEqual(await importFolder({ projectsRoot, home, src: '/' }), { ok: false, error: 'too broad' });
});

test('드라이브 최상위·Windows 사용자 목록 폴더는 거절', async () => {
  const { home, projectsRoot } = setup('app');
  for (const src of ['/mnt/c', '/mnt/c/', '/mnt/c/Users', '/mnt', '/mnt/c/Users/g']) {
    const r = await importFolder({ projectsRoot, home, src });
    assert.deepEqual(r, { ok: false, error: 'too broad' }, src);
  }
});

test('claude 실행 중인 폴더는 이동 거절', async () => {
  const { home, projectsRoot, src } = setup('app');
  const r = await importFolder({ projectsRoot, home, src, isRunning: (p) => p === src });
  assert.deepEqual(r, { ok: false, error: 'running' });
  assert.ok(fs.existsSync(src));
});

test('런처 자신이 든 폴더는 이동 거절', async () => {
  const { home, projectsRoot, src } = setup('app');
  const r = await importFolder({ projectsRoot, home, src, selfDir: path.join(src, 'sub') });
  assert.deepEqual(r, { ok: false, error: 'self' });
});

test('런처 폴더 안의 하위 폴더도 이동 거절', async () => {
  const { home, projectsRoot, src } = setup('app');
  fs.mkdirSync(path.join(src, 'docs'));
  const r = await importFolder({ projectsRoot, home, src: path.join(src, 'docs'), selfDir: src });
  assert.deepEqual(r, { ok: false, error: 'self' });
  assert.ok(fs.existsSync(path.join(src, 'docs')));
});

test('복사 중 실패하면 만들다 만 폴더를 지운다', async () => {
  const { home, projectsRoot, src } = setup('app');
  const failing = async (_s, t) => { fs.mkdirSync(t); fs.writeFileSync(path.join(t, 'half'), ''); throw new Error('disk full'); };
  const r = await importFolder({ projectsRoot, home, src, isWindows: () => true, copy: failing });
  assert.equal(r.ok, false);
  assert.match(r.error, /disk full/);
  assert.equal(fs.existsSync(path.join(projectsRoot, 'app')), false);
});

// ── 가져오기 전 점검 ──

test('inspectImport: 이동/복사·이름·GitHub 저장소·같은 저장소 카드', async () => {
  const { home, projectsRoot, src } = setup('app');
  execFileSync('git', ['-C', src, 'remote', 'add', 'origin', 'https://github.com/alice/app.git']);
  const existing = [{ name: 'app-old', github: 'alice/app' }, { name: 'zzz', github: null }];
  const r = await inspectImport({ projectsRoot, home, src, existing });
  assert.deepEqual(r, {
    ok: true, path: src, name: 'app', mode: 'move', isRepo: true,
    github: 'alice/app', duplicateOf: 'app-old', nameTaken: false, children: [], historyTaken: false, historyShared: false,
  });
  const w = await inspectImport({ projectsRoot, home, src, existing: [], isWindows: () => true });
  assert.equal(w.mode, 'copy');
  assert.equal(w.duplicateOf, null);
});

test('inspectImport: 같은 이름이 있으면 nameTaken(거절 대신 새 이름을 묻도록)', async () => {
  const { home, projectsRoot, src } = setup('app');
  fs.mkdirSync(path.join(projectsRoot, 'app'));
  const r = await inspectImport({ projectsRoot, home, src, existing: [] });
  assert.equal(r.ok, true);
  assert.equal(r.nameTaken, true);
});

test('inspectImport: 저장소가 아닌 폴더 안에 저장소들 → children 으로 알려 줌', async () => {
  const { home, projectsRoot, src } = setup('app');
  const container = path.dirname(src); // home/dev
  fs.mkdirSync(path.join(container, 'notes')); // 저장소 아닌 하위 폴더는 제외
  const r = await inspectImport({ projectsRoot, home, src: container, existing: [] });
  assert.equal(r.ok, true);
  assert.equal(r.isRepo, false);
  assert.deepEqual(r.children, [src]);
});

test('inspectImport: 거절 사유는 importFolder 와 같다', async () => {
  const { home, projectsRoot } = setup('app');
  assert.deepEqual(await inspectImport({ projectsRoot, home, src: home, existing: [] }), { ok: false, error: 'too broad' });
  assert.deepEqual(await inspectImport({ projectsRoot, home, src: projectsRoot, existing: [] }), { ok: false, error: 'inside projects' });
  assert.deepEqual(await inspectImport({ projectsRoot, home, src: path.join(home, 'nope'), existing: [] }), { ok: false, error: 'not found' });
});

// ── Windows 에서 체크아웃된 저장소: 줄바꿈(CRLF)만 다른 파일은 되돌리고, 실제로 고친 파일은 그대로 ──
function crlfRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crlf-'));
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
  g('init', '-q');
  fs.writeFileSync(path.join(dir, 'same.txt'), 'a\nb\n');
  fs.writeFileSync(path.join(dir, 'edited.txt'), 'a\nb\n');
  fs.writeFileSync(path.join(dir, 'lf.txt'), 'x\n');
  g('add', '.');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  fs.writeFileSync(path.join(dir, 'same.txt'), 'a\r\nb\r\n'); // 줄바꿈만 다름
  fs.writeFileSync(path.join(dir, 'edited.txt'), 'a\r\nCHANGED\r\n'); // 실제 수정 + CRLF
  return { dir, g };
}

test('fixCrlfOnly: 줄바꿈만 다른 파일은 LF 로 되돌리고, 실제 수정은 손대지 않는다', async () => {
  const { dir, g } = crlfRepo();
  const r = await fixCrlfOnly(dir);
  assert.deepEqual(r, { fixed: ['same.txt'] });
  assert.equal(fs.readFileSync(path.join(dir, 'same.txt'), 'utf8'), 'a\nb\n');
  assert.equal(fs.readFileSync(path.join(dir, 'edited.txt'), 'utf8'), 'a\r\nCHANGED\r\n');
  assert.equal(g('status', '--porcelain').trim(), 'M edited.txt');
});

test('fixCrlfOnly: 저장소가 아니거나 커밋이 없으면 아무것도 안 함', async () => {
  const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-'));
  assert.deepEqual(await fixCrlfOnly(plain), { fixed: [] });
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
  execFileSync('git', ['-C', empty, 'init', '-q']);
  fs.writeFileSync(path.join(empty, 'a.txt'), 'a\r\n');
  assert.deepEqual(await fixCrlfOnly(empty), { fixed: [] });
});

test('Windows 폴더 복사 시 줄바꿈만 다른 파일을 자동으로 정리하고 개수를 알려 준다', async () => {
  const { dir } = crlfRepo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ihome-'));
  const projectsRoot = path.join(home, 'projects');
  fs.mkdirSync(projectsRoot);
  const r = await importFolder({ projectsRoot, home, src: dir, isWindows: () => true });
  assert.equal(r.ok, true);
  assert.equal(r.crlfFixed, 1);
  assert.equal(fs.readFileSync(path.join(dir, 'same.txt'), 'utf8'), 'a\r\nb\r\n', '원본은 그대로');
});


// ── 점검 반영: 링크·숨김·대화 기록 겹침·claude 설정 ──────────────────────
test('링크 폴더를 복사하면 링크가 아니라 실제 폴더로 복사, 안쪽 상대 링크는 그대로', async () => {
  const { home, projectsRoot, src } = setup('app');
  fs.symlinkSync('README.md', path.join(src, 'readme-link'));
  const link = path.join(home, 'win-link');
  fs.symlinkSync(src, link);
  const r = await importFolder({ projectsRoot, home, src: link, isWindows: () => true });
  assert.equal(r.ok, true);
  const target = path.join(projectsRoot, 'app'); // 이름도 실제 폴더 기준
  assert.equal(r.path, target);
  assert.equal(fs.lstatSync(target).isSymbolicLink(), false);
  assert.ok(fs.lstatSync(target).isDirectory());
  assert.equal(fs.readlinkSync(path.join(target, 'readme-link')), 'README.md');
});

test('링크 폴더는 이동하지 않는다(실제 폴더를 고르도록)', async () => {
  const { home, projectsRoot, src } = setup('app');
  const link = path.join(home, 'link-app');
  fs.symlinkSync(src, link);
  assert.deepEqual(await importFolder({ projectsRoot, home, src: link }), { ok: false, error: 'symlink' });
  assert.equal((await inspectImport({ projectsRoot, home, src: link })).error, 'symlink');
  assert.ok(fs.existsSync(src));
});

test('숨김 폴더(.으로 시작)는 가져오지 않고, 숨김 이름으로도 가져오지 않는다', async () => {
  const { home, projectsRoot, src } = setup('app');
  const hidden = path.join(home, '.secret');
  fs.mkdirSync(hidden);
  assert.deepEqual(await importFolder({ projectsRoot, home, src: hidden }), { ok: false, error: 'hidden' });
  assert.equal((await inspectImport({ projectsRoot, home, src: hidden })).error, 'hidden');
  assert.deepEqual(await importFolder({ projectsRoot, home, src, name: '.app' }), { ok: false, error: 'invalid name' });
  assert.ok(fs.existsSync(src));
});

test('그 이름의 대화 기록이 이미 남아 있으면(예전에 지운 같은 이름) 새 이름을 받도록 거절', async () => {
  const { home, projectsRoot, src } = setup('app', { session: true });
  const stale = sessDir(home, path.join(projectsRoot, 'app'));
  fs.mkdirSync(stale, { recursive: true });
  fs.writeFileSync(path.join(stale, 'old.jsonl'), '{}\n');
  const info = await inspectImport({ projectsRoot, home, src });
  assert.equal(info.historyTaken, true);
  assert.deepEqual(await importFolder({ projectsRoot, home, src }), { ok: false, error: 'history taken' });
  assert.ok(fs.existsSync(src), '아무것도 옮기지 않음');
  const r = await importFolder({ projectsRoot, home, src, name: 'app-2' });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(path.join(sessDir(home, path.join(projectsRoot, 'app-2')), 'abc.jsonl')), '자기 기록은 새 이름으로');
  assert.ok(fs.existsSync(path.join(stale, 'old.jsonl')), '옛 기록은 그대로');
});

test('대화 기록 폴더를 이름이 겹치는 다른 폴더와 같이 쓰면(한글 경로) 기록은 옮기지 않고 알린다', async () => {
  const { home, projectsRoot } = setup('x');
  const a = path.join(home, 'work', '가나'); const b = path.join(home, 'work', '다라');
  fs.mkdirSync(a, { recursive: true }); fs.mkdirSync(b, { recursive: true });
  assert.equal(encode(a), encode(b));
  const shared = sessDir(home, a);
  fs.mkdirSync(shared, { recursive: true });
  fs.writeFileSync(path.join(shared, 'a.jsonl'), JSON.stringify({ cwd: a }) + '\n');
  fs.writeFileSync(path.join(shared, 'b.jsonl'), JSON.stringify({ cwd: b }) + '\n');
  assert.equal((await inspectImport({ projectsRoot, home, src: a })).historyShared, true);
  const r = await importFolder({ projectsRoot, home, src: a });
  assert.equal(r.ok, true);
  assert.equal(r.historyKept, true);
  assert.ok(fs.existsSync(path.join(shared, 'b.jsonl')), '다른 폴더 기록은 제자리');
  assert.ok(fs.existsSync(path.join(shared, 'a.jsonl')));
});

test('가져오면 ~/.claude.json 의 폴더 신뢰·local MCP 설정이 새 경로로 따라온다', async () => {
  const { home, projectsRoot, src } = setup('app');
  const cj = path.join(home, '.claude.json');
  fs.writeFileSync(cj, JSON.stringify({ projects: { [src]: { hasTrustDialogAccepted: true, mcpServers: { db: { command: 'x' } } } } }));
  const r = await importFolder({ projectsRoot, home, src });
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(cj, 'utf8')).projects[r.path], { hasTrustDialogAccepted: true, mcpServers: { db: { command: 'x' } } });
});
