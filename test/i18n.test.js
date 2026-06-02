// test/i18n.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, t, getLang, setLang, LANGS, DICT } from '../public/i18n.js';

test('LANGS: ko/en/ja 세 언어', () => {
  assert.deepEqual(LANGS, ['ko', 'en', 'ja']);
});

test('translate: 정적 문자열이 언어별로 정확', () => {
  assert.equal(translate('ko', 'appTitle'), 'Claude WSL Launcher V2');
  assert.equal(translate('en', 'appTitle'), 'Claude WSL Launcher V2');
  assert.equal(translate('ja', 'appTitle'), 'Claude WSL Launcher V2');
});

test('translate: 함수형(동적) 엔트리가 인자로 포맷', () => {
  assert.equal(translate('ko', 'minAgo', 5), '5분 전');
  assert.equal(translate('en', 'minAgo', 5), '5 min ago');
  assert.equal(translate('ja', 'minAgo', 5), '5分前');
  assert.equal(translate('ko', 'behind', 3), '↓ 3개 뒤짐');
  assert.equal(translate('en', 'pullConfirm', 'todo'), 'Pull todo? (fast-forward only)');
});

test('translate: 미존재 키는 키 문자열 그대로 폴백', () => {
  assert.equal(translate('en', 'nope__missing'), 'nope__missing');
});

test('translate: 알 수 없는 언어는 ko 로 폴백', () => {
  assert.equal(translate('zz', 'appTitle'), 'Claude WSL Launcher V2');
});

test('사전 키 정합성: en·ja 가 ko 와 동일한 키 집합', () => {
  const koKeys = Object.keys(DICT.ko).sort();
  assert.deepEqual(Object.keys(DICT.en).sort(), koKeys, 'en 키가 ko 와 다름');
  assert.deepEqual(Object.keys(DICT.ja).sort(), koKeys, 'ja 키가 ko 와 다름');
});

test('사전 값 타입 정합성: 같은 키는 세 언어에서 모두 함수이거나 모두 문자열', () => {
  for (const k of Object.keys(DICT.ko)) {
    const types = ['ko', 'en', 'ja'].map((l) => typeof DICT[l][k]);
    assert.ok(types.every((x) => x === types[0]), `키 '${k}' 의 타입이 언어별로 불일치: ${types}`);
  }
});

test('getLang: 기본값 ko, setLang 후 반영, 잘못된 값 무시', () => {
  assert.equal(getLang(), 'ko'); // 초기(저장값 없음) → ko
  setLang('en');
  assert.equal(getLang(), 'en');
  setLang('xx'); // 무효
  assert.equal(getLang(), 'en'); // 유지
  setLang('ko'); // 정리
});

test('t: 현재 언어 기준 번역', () => {
  setLang('ja');
  assert.equal(t('refresh'), '更新');
  setLang('ko');
  assert.equal(t('refresh'), '새로고침');
});
