// test/single-instance.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { findRunningLauncher } from '../server/single-instance.js';

test('findRunningLauncher: 범위 안에서 우리 런처가 답하는 첫 포트, 없으면 null', async () => {
  const seen = [];
  const probe = async (p) => { seen.push(p); return p === 41732; };
  assert.equal(await findRunningLauncher({ ports: [41730, 41731, 41732, 41733], probe }), 41732);
  assert.equal(await findRunningLauncher({ ports: [41730, 41731], probe: async () => false }), null);
  assert.equal(await findRunningLauncher({ ports: [41730], probe: async () => { throw new Error('x'); } }), null, '조회 오류는 없음으로');
});

test('기본 조회: /api/health 의 app 마커가 우리 것일 때만 true(남의 앱·빈 포트는 false)', async () => {
  const mk = (body) => new Promise((resolve) => {
    const srv = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(body); });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const ours = await mk(JSON.stringify({ app: 'claude-wsl-launcher', port: 1 }));
  const other = await mk(JSON.stringify({ app: 'something-else' }));
  try {
    const pOurs = ours.address().port; const pOther = other.address().port;
    assert.equal(await findRunningLauncher({ ports: [pOther, pOurs] }), pOurs);
    assert.equal(await findRunningLauncher({ ports: [pOther] }), null);
    assert.equal(await findRunningLauncher({ ports: [1] }), null, '아무도 안 듣는 포트');
  } finally {
    ours.close(); other.close();
  }
});
