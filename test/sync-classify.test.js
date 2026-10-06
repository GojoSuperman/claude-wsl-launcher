// test/sync-classify.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../public/sync-classify.js';

test('classify: 둘 다 0 → synced', () => assert.equal(classify(0, 0), 'synced'));
test('classify: behind만 → behind', () => assert.equal(classify(0, 3), 'behind'));
test('classify: ahead만 → ahead', () => assert.equal(classify(5, 0), 'ahead'));
test('classify: 둘 다 양수 → diverged', () => assert.equal(classify(2, 4), 'diverged'));
