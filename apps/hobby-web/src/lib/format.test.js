import { describe, expect, it } from 'vitest';

import { formatMeetAt, initialOf } from './format.js';

// #318: KST 강제. 입력은 UTC ISO 로 줘서 KST 변환 결과를 검증한다.
// UTC 01:00 + 9h = KST 10:00 — KST 자정 기준 day-diff 계산용 기준점.
const NOW = new Date('2026-05-19T01:00:00Z');

describe('formatMeetAt — KST 표기 (#318)', () => {
  it('오늘 KST 18:00 (= UTC 09:00) → "오늘 18:00 (KST)"', () => {
    expect(formatMeetAt(new Date('2026-05-19T09:00:00Z'), NOW)).toBe('오늘 18:00 (KST)');
  });

  it('내일 KST 09:30 (= UTC 2026-05-20 00:30) → "내일 09:30 (KST)"', () => {
    expect(formatMeetAt(new Date('2026-05-20T00:30:00Z'), NOW)).toBe('내일 09:30 (KST)');
  });

  it('주말 KST 14:00 (2026-05-23 토 = UTC 05:00) → "5/23 (토) 14:00 (KST)"', () => {
    expect(formatMeetAt(new Date('2026-05-23T05:00:00Z'), NOW)).toBe('5/23 (토) 14:00 (KST)');
  });

  it('잘못된 입력이면 빈 문자열', () => {
    expect(formatMeetAt('not-a-date', NOW)).toBe('');
  });
});

describe('initialOf', () => {
  it('한국어 이름의 첫 자를 반환', () => {
    expect(initialOf('진현')).toBe('진');
  });

  it('빈 문자열이면 "?"', () => {
    expect(initialOf('')).toBe('?');
  });

  it('공백 전용 입력이면 "?" (CR 회귀 가드)', () => {
    expect(initialOf('   ')).toBe('?');
  });

  it('null/undefined 도 "?"', () => {
    expect(initialOf(null)).toBe('?');
    expect(initialOf(undefined)).toBe('?');
  });
});
