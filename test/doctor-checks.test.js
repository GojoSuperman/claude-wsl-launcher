// test/doctor-checks.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'doctor-checks.sh');

// lib 를 source 한 뒤 bash 스니펫 실행 → stdout(trim) 반환. input 으로 stdin 주입 가능.
function sh(snippet, input = '') {
  return execFileSync('bash', ['-c', `source ${JSON.stringify(LIB)}; ${snippet}`], {
    input,
    encoding: 'utf8',
  }).trim();
}

test('classify_claude: 빈 값 → missing', () => {
  assert.equal(sh('classify_claude ""'), 'missing');
});
test('classify_claude: /mnt 경로 → windows', () => {
  assert.equal(sh('classify_claude /mnt/c/Users/x/AppData/Roaming/npm/claude'), 'windows');
});
test('classify_claude: nvm/홈 경로 → native', () => {
  assert.equal(sh('classify_claude /home/u/.nvm/versions/node/v24.16.0/bin/claude'), 'native');
});
test('parse_node_major: v24.16.0 → 24', () => {
  assert.equal(sh('parse_node_major v24.16.0'), '24');
});
test('parse_node_major: 앞 v 없어도 → 8', () => {
  assert.equal(sh('parse_node_major 8.1.0'), '8');
});
test('parse_node_major: 쓰레기 → 빈값', () => {
  assert.equal(sh('parse_node_major hello'), '');
});
test('is_node_ge: 24 >= 20 → 0(OK)', () => {
  assert.equal(sh('is_node_ge v24.16.0 20 && echo OK || echo NO'), 'OK');
});
test('is_node_ge: 18 >= 20 → 1(NO)', () => {
  assert.equal(sh('is_node_ge v18.20.0 20 && echo OK || echo NO'), 'NO');
});
test('is_node_ge: 파싱불가 → 2', () => {
  assert.equal(sh('is_node_ge xyz 20; echo $?'), '2');
});

// ask_yn: stdin 으로 답을 주입. 프롬프트는 stderr 라 stdout 에 안 섞임.
test('ask_yn: y → 예(0)', () => {
  assert.equal(sh('ask_yn "설치할까요?" && echo YES || echo NO', 'y\n'), 'YES');
});
test('ask_yn: n → 아니요(1)', () => {
  assert.equal(sh('ask_yn "설치할까요?" && echo YES || echo NO', 'n\n'), 'NO');
});
test('ask_yn: 빈 입력(Enter) → 아니요(기본 N)', () => {
  assert.equal(sh('ask_yn "설치할까요?" && echo YES || echo NO', '\n'), 'NO');
});
test('run_or_show: DRY_RUN 이면 실행 대신 RUN> 출력', () => {
  assert.equal(sh('DOCTOR_DRY_RUN=1 run_or_show npm install --prefix /x'), 'RUN> npm install --prefix /x');
});
test('run_or_show: 평소엔 실제 실행', () => {
  assert.equal(sh('run_or_show echo 안녕'), '안녕');
});
