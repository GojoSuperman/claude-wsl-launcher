// test/team-role.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRole, isTeamRole, infoForUser } from '../public/team-role.js';

const base = { owner: 'alice', ownerType: 'User', me: 'alice', permission: 'ADMIN', collaborators: 1 };

test('내 저장소 + 협업자 나 혼자 → solo, 협업자 2명 이상 → leader', () => {
  assert.equal(computeRole(base), 'solo');
  assert.equal(computeRole({ ...base, collaborators: 2 }), 'leader');
  assert.equal(computeRole({ ...base, collaborators: null }), 'solo');
  assert.equal(computeRole({ ...base, me: 'ALICE', collaborators: 2 }), 'leader'); // 대소문자 무시
});

test('남의 저장소: WRITE·MAINTAIN → member, READ·TRIAGE → readonly', () => {
  const other = { ...base, owner: 'alice', me: 'Bob', collaborators: null };
  assert.equal(computeRole({ ...other, permission: 'WRITE' }), 'member');
  assert.equal(computeRole({ ...other, permission: 'MAINTAIN' }), 'member');
  assert.equal(computeRole({ ...other, permission: 'READ' }), 'readonly');
  assert.equal(computeRole({ ...other, permission: 'TRIAGE' }), 'readonly');
});

test('조직 저장소: ADMIN → leader, WRITE → member / 남의 개인 저장소 ADMIN → member', () => {
  const org = { owner: 'acme-org', ownerType: 'Organization', me: 'alice', collaborators: null };
  assert.equal(computeRole({ ...org, permission: 'ADMIN' }), 'leader');
  assert.equal(computeRole({ ...org, permission: 'WRITE' }), 'member');
  assert.equal(computeRole({ ...base, me: 'Bob', permission: 'ADMIN' }), 'member');
});

test('정보 부족 → null, isTeamRole 은 leader·member 만', () => {
  assert.equal(computeRole(null), null);
  assert.equal(computeRole({ ...base, me: null }), null);
  assert.equal(computeRole({ ...base, permission: null }), null);
  assert.deepEqual(['leader', 'member', 'readonly', 'solo', null].map(isTeamRole), [true, true, false, false, false]);
});

test('infoForUser: 폴더 사용자가 gh 활성 계정과 다르면 권한을 협업자 목록으로 판단', () => {
  const info = { owner: 'alice', ownerType: 'User', permission: 'ADMIN', collaborators: 2, members: ['alice', 'Bob'] };
  assert.equal(infoForUser(info, 'alice', 'alice'), info); // 같으면 그대로
  assert.equal(infoForUser(info, null, 'alice'), info);
  const asMember = infoForUser(info, 'bob', 'alice');
  assert.equal(asMember.permission, 'WRITE');
  assert.equal(computeRole({ ...asMember, me: 'Bob' }), 'member');
  assert.equal(infoForUser(info, 'stranger', 'alice').permission, null);
  assert.equal(computeRole({ ...infoForUser(info, 'stranger', 'alice'), me: 'stranger' }), null);
});
