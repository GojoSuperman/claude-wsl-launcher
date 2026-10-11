// test/config.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../server/config.js';

test('normalizeRoot: ~, ~/x, 절대, 상대, 빈값', () => {
  assert.equal(normalizeRoot('~', '/home/g'), '/home/g');
  assert.equal(normalizeRoot('~/dev', '/home/g'), '/home/g/dev');
  assert.equal(normalizeRoot('/srv/x/', '/home/g'), '/srv/x/');
  assert.equal(normalizeRoot('repos', '/home/g'), '/home/g/repos');
  assert.equal(normalizeRoot('  ', '/home/g'), null);
  assert.equal(normalizeRoot(undefined, '/home/g'), null);
});
