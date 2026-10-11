// test/pr-status.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickLatestPr, prForBranch, openPrs } from '../server/pr-status.js';

const pr = (number, state, extra = {}) => ({ number, state, mergeable: 'MERGEABLE', title: `t${number}`, url: `u${number}`, author: { login: 'Bob' }, ...extra });

test('pickLatestPr: 같은 브랜치에 닫힌 #2 + 열린 #3 → #3, 빈 목록 → null, author 는 login', () => {
  assert.deepEqual(pickLatestPr([pr(2, 'CLOSED'), pr(3, 'OPEN')]),
    { number: 3, state: 'OPEN', mergeable: 'MERGEABLE', title: 't3', url: 'u3', author: 'Bob' });
  assert.equal(pickLatestPr([]), null);
  assert.equal(pickLatestPr(null), null);
});

test('prForBranch: 슬래시 브랜치도 인자 그대로 전달, 실패 → null', async () => {
  let got;
  const r = await prForBranch('o/r', 'hackathon2/participant-04', async (args) => { got = args; return [pr(9, 'OPEN', { mergeable: 'CONFLICTING' })]; });
  assert.deepEqual(got.slice(0, 6), ['pr', 'list', '-R', 'o/r', '--head', 'hackathon2/participant-04']);
  assert.equal(r.mergeable, 'CONFLICTING');
  assert.equal(await prForBranch('o/r', 'b', async () => { throw new Error('x'); }), null);
  assert.equal(await prForBranch('o/r', '', async () => []), null);
});

test('openPrs: 열린 PR 목록(작성자 login), 실패 → null', async () => {
  const list = await openPrs('o/r', async () => [{ number: 7, title: 'a', url: 'u7', author: { login: 'Bob' }, isDraft: false }]);
  assert.deepEqual(list, [{ number: 7, title: 'a', url: 'u7', author: 'Bob', isDraft: false }]);
  assert.equal(await openPrs('o/r', async () => { throw new Error('x'); }), null);
});
