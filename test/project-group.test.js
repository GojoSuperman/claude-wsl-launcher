// test/project-group.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupProjects } from '../public/project-group.js';

test('groupProjects: github 유무로 분할 + 기본 이름순', () => {
  const r = groupProjects([
    { name: 'zebra', github: null },
    { name: 'apple', github: null },
    { name: 'banana', github: 'o/b' },
  ]);
  assert.deepEqual(r.noGithub.map((p) => p.name), ['apple', 'zebra']);
  assert.deepEqual(r.github.map((p) => p.name), ['banana']);
});

test('groupProjects: 저장된 순서를 그룹별로 따름', () => {
  const r = groupProjects([
    { name: 'a', github: null },
    { name: 'b', github: null },
    { name: 'c', github: 'o/c' },
    { name: 'd', github: 'o/d' },
  ], ['d', 'b', 'c', 'a']);
  assert.deepEqual(r.noGithub.map((p) => p.name), ['b', 'a']);
  assert.deepEqual(r.github.map((p) => p.name), ['d', 'c']);
});

test('groupProjects: 순서에 없는 새 프로젝트는 그룹 맨 앞(이름순), 사라진 이름은 무시', () => {
  const r = groupProjects([
    { name: 'old2', github: null },
    { name: 'old1', github: null },
    { name: 'zNew', github: null },
    { name: 'aNew', github: null },
  ], ['old2', 'gone', 'old1']);
  assert.deepEqual(r.noGithub.map((p) => p.name), ['aNew', 'zNew', 'old2', 'old1']);
});

test('groupProjects: 빈/비배열 → 빈 두 그룹', () => {
  assert.deepEqual(groupProjects(null), { noGithub: [], github: [] });
});
