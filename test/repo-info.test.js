// test/repo-info.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepoInfo, createRepoInfoLookup, createMeLookup, graphqlArgs } from '../server/repo-info.js';

const full = { data: { repository: {
  visibility: 'PRIVATE', owner: { login: 'alice', __typename: 'User' }, viewerPermission: 'ADMIN',
  defaultBranchRef: { name: 'main' }, collaborators: { totalCount: 2, nodes: [{ login: 'alice' }, { login: 'Bob' }] },
} } };

test('parseRepoInfo: 필요한 값만 뽑음, 협업자 없으면 null', () => {
  assert.deepEqual(parseRepoInfo(full), {
    visibility: 'PRIVATE', owner: 'alice', ownerType: 'User', permission: 'ADMIN',
    collaborators: 2, members: ['alice', 'Bob'], defaultBranch: 'main',
  });
  const noCollab = structuredClone(full); delete noCollab.data.repository.collaborators;
  noCollab.data.repository.defaultBranchRef = null;
  const r = parseRepoInfo(noCollab);
  assert.equal(r.collaborators, null); assert.equal(r.members, null); assert.equal(r.defaultBranch, null);
  assert.equal(parseRepoInfo({ data: { repository: null } }), null);
  assert.equal(parseRepoInfo(null), null);
});

test('협업자 조회가 실패하면(팀원 권한) 협업자 없이 다시 묻는다', async () => {
  const calls = [];
  const runner = async (r, { withCollaborators }) => {
    calls.push(withCollaborators);
    if (withCollaborators) throw new Error('Must have push access to view repository collaborators.');
    const j = structuredClone(full); delete j.data.repository.collaborators;
    j.data.repository.viewerPermission = 'WRITE';
    return j;
  };
  const info = await createRepoInfoLookup({ runner }).get('alice/team-test');
  assert.deepEqual(calls, [true, false]);
  assert.equal(info.permission, 'WRITE');
  assert.equal(info.members, null);
});

test('캐시: TTL 안에는 runner 1회, 잘못된 이름은 호출 없이 null, 실패는 null', async () => {
  let n = 0;
  const lookup = createRepoInfoLookup({ runner: async () => { n++; return full; } });
  await lookup.get('alice/team-test'); await lookup.get('alice/team-test');
  assert.equal(n, 1);
  assert.equal(await lookup.get('-x/y'), null);
  assert.equal(n, 1);
  lookup.invalidate('alice/team-test'); await lookup.get('alice/team-test');
  assert.equal(n, 2);
  const failing = createRepoInfoLookup({ runner: async () => { throw new Error('offline'); } });
  assert.equal(await failing.get('a/b'), null);
});

test('createMeLookup: 성공은 계속 기억, 실패는 null 후 30초 뒤 재시도', async () => {
  let n = 0; let t = 0;
  const ok = createMeLookup({ runner: async () => { n++; return 'alice'; }, now: () => t });
  assert.equal(await ok.get(), 'alice'); assert.equal(await ok.get(), 'alice');
  assert.equal(n, 1);
  let m = 0;
  const bad = createMeLookup({ runner: async () => { m++; throw new Error('no gh'); }, now: () => t });
  assert.equal(await bad.get(), null); assert.equal(await bad.get(), null);
  assert.equal(m, 1);
  t = 31_000; await bad.get();
  assert.equal(m, 2);
});

test('graphqlArgs: owner·이름은 -f(문자열 그대로) — 숫자 이름(2048) 저장소도 String 으로', () => {
  const a = graphqlArgs('123/2048', true);
  assert.deepEqual(a.slice(0, 2), ['api', 'graphql']);
  assert.ok(a.includes('o=123') && a.includes('n=2048'));
  assert.equal(a[a.indexOf('o=123') - 1], '-f');
  assert.equal(a[a.indexOf('n=2048') - 1], '-f');
  assert.ok(!a.includes('-F'));
  assert.ok(a.join(' ').includes('collaborators'));
  assert.ok(!graphqlArgs('o/n', false).join(' ').includes('collaborators'));
});
