// test/trash.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listTrash, restoreTrash, purgeTrash } from '../server/trash.js';

// 가짜 휴지통: gio trash 와 같은 모양(files/<id> + info/<id>.trashinfo, Path 는 퍼센트 인코딩)
function setup() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'trash-'));
  const trashDir = path.join(base, 'Trash');
  const projectsRoot = path.join(base, 'projects');
  fs.mkdirSync(path.join(trashDir, 'files'), { recursive: true });
  fs.mkdirSync(path.join(trashDir, 'info'), { recursive: true });
  fs.mkdirSync(projectsRoot);
  const put = (id, orig, date, { file = true } = {}) => {
    if (file) { fs.mkdirSync(path.join(trashDir, 'files', id)); fs.writeFileSync(path.join(trashDir, 'files', id, 'a.txt'), id); }
    const enc = orig.split('/').map(encodeURIComponent).join('/');
    fs.writeFileSync(path.join(trashDir, 'info', `${id}.trashinfo`), `[Trash Info]\nPath=${enc}\nDeletionDate=${date}\n`);
  };
  return { trashDir, projectsRoot, put };
}

test('listTrash: 작업 폴더 바로 아래에서 지운 것만, 최근 삭제 먼저, 한글 이름 디코딩', () => {
  const { trashDir, projectsRoot, put } = setup();
  put('test', path.join(projectsRoot, 'test'), '2026-10-11T20:50:58');
  put('공모전.2', path.join(projectsRoot, '공모전'), '2026-10-12T09:00:00');
  put('other', '/home/x/elsewhere/other', '2026-10-12T10:00:00'); // 작업 폴더 밖 → 제외
  put('deep', path.join(projectsRoot, 'a', 'deep'), '2026-10-12T10:00:00'); // 직속 아님 → 제외
  put('gone', path.join(projectsRoot, 'gone'), '2026-10-12T10:00:00', { file: false }); // 실물 없음 → 제외
  assert.deepEqual(listTrash({ trashDir, projectsRoot }), [
    { id: '공모전.2', name: '공모전', deletedAt: '2026-10-12T09:00:00', taken: false },
    { id: 'test', name: 'test', deletedAt: '2026-10-11T20:50:58', taken: false },
  ]);
  fs.mkdirSync(path.join(projectsRoot, 'test'));
  assert.equal(listTrash({ trashDir, projectsRoot }).find((e) => e.id === 'test').taken, true);
  assert.deepEqual(listTrash({ trashDir: path.join(trashDir, 'nope'), projectsRoot }), []);
});

test('restoreTrash: 원래 자리로 옮기고 휴지통 기록 삭제', () => {
  const { trashDir, projectsRoot, put } = setup();
  put('test', path.join(projectsRoot, 'test'), '2026-10-11T20:50:58');
  assert.deepEqual(restoreTrash({ trashDir, projectsRoot, id: 'test' }), { ok: true, name: 'test' });
  assert.equal(fs.readFileSync(path.join(projectsRoot, 'test', 'a.txt'), 'utf8'), 'test');
  assert.equal(fs.existsSync(path.join(trashDir, 'files', 'test')), false);
  assert.equal(fs.existsSync(path.join(trashDir, 'info', 'test.trashinfo')), false);
});

test('restoreTrash: 같은 이름이 있으면 거절, 새 이름을 주면 그 이름으로', () => {
  const { trashDir, projectsRoot, put } = setup();
  put('test', path.join(projectsRoot, 'test'), '2026-10-11T20:50:58');
  fs.mkdirSync(path.join(projectsRoot, 'test'));
  assert.deepEqual(restoreTrash({ trashDir, projectsRoot, id: 'test' }), { ok: false, error: 'already exists' });
  assert.deepEqual(restoreTrash({ trashDir, projectsRoot, id: 'test', name: 'test-2' }), { ok: true, name: 'test-2' });
  assert.equal(fs.existsSync(path.join(projectsRoot, 'test-2', 'a.txt')), true);
});

test('restoreTrash: 없는 항목·작업 폴더 밖·이상한 id/이름은 거절', () => {
  const { trashDir, projectsRoot, put } = setup();
  put('other', '/home/x/elsewhere/other', '2026-10-12T10:00:00');
  put('ok', path.join(projectsRoot, 'ok'), '2026-10-12T10:00:00');
  assert.equal(restoreTrash({ trashDir, projectsRoot, id: 'nope' }).error, 'not found');
  assert.equal(restoreTrash({ trashDir, projectsRoot, id: 'other' }).error, 'not found');
  assert.equal(restoreTrash({ trashDir, projectsRoot, id: '../ok' }).error, 'not found');
  assert.equal(restoreTrash({ trashDir, projectsRoot, id: 'ok', name: '../x' }).error, 'invalid name');
  assert.equal(restoreTrash({ trashDir, projectsRoot, id: 'ok', name: '.hidden' }).error, 'invalid name');
});

test('purgeTrash: 휴지통 실물과 기록을 지운다(되돌릴 수 없음)', () => {
  const { trashDir, projectsRoot, put } = setup();
  put('test', path.join(projectsRoot, 'test'), '2026-10-11T20:50:58');
  put('keep', path.join(projectsRoot, 'keep'), '2026-10-11T20:50:58');
  assert.deepEqual(purgeTrash({ trashDir, projectsRoot, id: 'test' }), { ok: true });
  assert.equal(fs.existsSync(path.join(trashDir, 'files', 'test')), false);
  assert.equal(fs.existsSync(path.join(trashDir, 'info', 'test.trashinfo')), false);
  assert.deepEqual(listTrash({ trashDir, projectsRoot }).map((e) => e.id), ['keep']);
});

test('purgeTrash: 작업 폴더 밖에서 지운 것·없는 항목·경로 탈출은 건드리지 않음', () => {
  const { trashDir, projectsRoot, put } = setup();
  put('other', '/home/x/elsewhere/other', '2026-10-12T10:00:00');
  assert.equal(purgeTrash({ trashDir, projectsRoot, id: 'other' }).error, 'not found');
  assert.equal(fs.existsSync(path.join(trashDir, 'files', 'other')), true);
  assert.equal(purgeTrash({ trashDir, projectsRoot, id: 'nope' }).error, 'not found');
  assert.equal(purgeTrash({ trashDir, projectsRoot, id: '..' }).error, 'not found');
});
