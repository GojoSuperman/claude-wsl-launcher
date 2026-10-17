// test/recent-launches.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecentLaunches } from '../server/recent-launches.js';

test('방금 실행한 폴더는 ttl 동안 "켜는 중", 지나면 아님, 다른 폴더는 무관', () => {
  let clock = 0;
  const r = createRecentLaunches({ ttlMs: 60_000, now: () => clock });
  assert.equal(r.isStarting('/p/a'), false);
  r.mark('/p/a');
  clock = 59_999;
  assert.equal(r.isStarting('/p/a'), true);
  assert.equal(r.isStarting('/p/b'), false);
  clock = 60_000;
  assert.equal(r.isStarting('/p/a'), false);
});

test('다시 실행하면 그때부터 다시 센다', () => {
  let clock = 0;
  const r = createRecentLaunches({ ttlMs: 1000, now: () => clock });
  r.mark('/p/a');
  clock = 900; r.mark('/p/a');
  clock = 1500;
  assert.equal(r.isStarting('/p/a'), true);
});
