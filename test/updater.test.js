// test/updater.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPullError, needsUpdate } from '../server/updater.js';

test('로컬 변경이 있어 pull 이 거부되면 local-changes', () => {
  const real = 'error: Your local changes to the following files would be overwritten by merge:\n\tpublic/app.js\n'
    + 'Please commit your changes or stash them before you merge.';
  assert.equal(classifyPullError(real), 'local-changes');
});

test('fast-forward 불가(갈라짐)는 diverged', () => {
  assert.equal(classifyPullError('fatal: Not possible to fast-forward, aborting.'), 'diverged');
  assert.equal(classifyPullError('hint: divergent branches'), 'diverged');
});

test('네트워크 실패는 network', () => {
  assert.equal(classifyPullError('fatal: unable to access ... Could not resolve host: github.com'), 'network');
  assert.equal(classifyPullError('ssh: connect to host github.com port 22: Network is unreachable'), 'network');
});

test('분류 안 되면 null (원문 노출)', () => {
  assert.equal(classifyPullError('something else'), null);
  assert.equal(classifyPullError(''), null);
});

test('needsUpdate: behind 가 0 보다 크면 true', () => {
  assert.equal(needsUpdate({ behind: 3 }), true);
  assert.equal(needsUpdate({ behind: 0 }), false);
  assert.equal(needsUpdate({}), false);
  assert.equal(needsUpdate(null), false);
});
