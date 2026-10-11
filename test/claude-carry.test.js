// test/claude-carry.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionOwner, carryClaudeConfig } from '../server/claude-carry.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'carry-'));
const jsonl = (dir, id, cwd) => {
  fs.mkdirSync(dir, { recursive: true });
  const lines = [JSON.stringify({ type: 'summary' }), cwd ? JSON.stringify({ type: 'user', cwd }) : '{}'];
  fs.writeFileSync(path.join(dir, `${id}.jsonl`), lines.join('\n') + '\n');
};

test('sessionOwner: 기록 폴더 없음 → none, 대화 없이 메모리만 → mine, 모두 이 폴더 → mine, 다른 폴더 기록이 섞이면 mixed', () => {
  const d = path.join(tmp(), 'sess');
  assert.equal(sessionOwner(d, '/home/g/work/가나'), 'none');
  fs.mkdirSync(path.join(d, 'memory'), { recursive: true }); // 대화 없이 메모리만 있어도 이 폴더 것
  assert.equal(sessionOwner(d, '/home/g/work/가나'), 'mine');
  jsonl(d, 'a', '/home/g/work/가나');
  jsonl(d, 'b', null); // cwd 없는 기록은 판단에서 뺀다
  assert.equal(sessionOwner(d, '/home/g/work/가나'), 'mine');
  jsonl(d, 'c', '/home/g/work/다라'); // encode 가 같은 다른 폴더
  assert.equal(sessionOwner(d, '/home/g/work/가나'), 'mixed');
});

test('carryClaudeConfig: 신뢰·MCP·도구 허용 같은 폴더별 설정만 새 경로로 복사, 다른 키는 그대로', () => {
  const f = path.join(tmp(), '.claude.json');
  const from = '/home/g/dev/app'; const target = '/home/g/projects/app';
  fs.writeFileSync(f, JSON.stringify({
    numStartups: 3,
    projects: { [from]: { hasTrustDialogAccepted: true, mcpServers: { db: { command: 'x' } }, allowedTools: ['Bash'], lastCost: 1.5 } },
  }));
  assert.deepEqual(carryClaudeConfig(f, from, target), { ok: true, carried: true });
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(j.numStartups, 3);
  assert.deepEqual(j.projects[target], { hasTrustDialogAccepted: true, mcpServers: { db: { command: 'x' } }, allowedTools: ['Bash'] });
  assert.ok(j.projects[from], '옛 항목은 남겨 둔다');
});

test('carryClaudeConfig: 새 경로 항목이 이미 있거나, 옛 항목·파일이 없으면 아무것도 안 바꿈', () => {
  const f = path.join(tmp(), '.claude.json');
  assert.deepEqual(carryClaudeConfig(f, '/a', '/b'), { ok: true, carried: false });
  const body = JSON.stringify({ projects: { '/a': { hasTrustDialogAccepted: true }, '/b': { hasTrustDialogAccepted: false } } });
  fs.writeFileSync(f, body);
  assert.deepEqual(carryClaudeConfig(f, '/a', '/b'), { ok: true, carried: false });
  assert.equal(fs.readFileSync(f, 'utf8'), body);
  assert.deepEqual(carryClaudeConfig(f, '/none', '/c'), { ok: true, carried: false });
  fs.writeFileSync(f, '{broken');
  assert.equal(carryClaudeConfig(f, '/a', '/c').ok, false);
  assert.equal(fs.readFileSync(f, 'utf8'), '{broken', '깨진 파일은 건드리지 않음');
});
