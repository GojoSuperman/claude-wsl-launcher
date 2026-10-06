#!/usr/bin/env node
// 추가 계정으로 실행하기 직전에 공유 링크·스킬·MCP 를 맞춘다. (server/account-sync.js 참고)
// 사용: node account-sync.mjs <계정 폴더>. launch-claude.sh --account 가 호출한다.
// 실패해도 claude 실행은 막지 않는다 — 경고만 남기고 exit 0.
import os from 'node:os';
import path from 'node:path';
import { syncAccount } from '../server/account-sync.js';

const home = process.env.HOME || os.homedir();
const dir = process.argv[2];
try {
  if (dir) {
    const r = syncAccount(home, path.resolve(dir));
    if (!r.skipped) {
      const parts = [];
      if (r.links.added.length) parts.push(`공유 +${r.links.added.length}`);
      if (r.skills.added.length) parts.push(`스킬 +${r.skills.added.length}`);
      if (r.skills.removed.length) parts.push(`스킬 -${r.skills.removed.length}`);
      if (r.mcp.changed) parts.push('MCP 갱신');
      if (parts.length) console.log(`[account-sync] ${parts.join(', ')}`);
    }
  }
} catch (e) {
  console.error(`[account-sync] 동기화 실패(무시하고 실행): ${e.message}`);
}
