import { describe, expect, it } from 'vitest';

import { formatMeetAt, initialOf } from './format.js';

const NOW = new Date('2026-05-19T10:00:00');

describe('formatMeetAt', () => {
  it('오늘이면 "오늘 HH:MM" 형식으로 표시', () => {
    expect(formatMeetAt(new Date('2026-05-19T18:00:00'), NOW)).toBe('오늘 18:00');
  });

  it('내일이면 "내일 HH:MM" 형식으로 표시', () => {
    expect(formatMeetAt(new Date('2026-05-20T09:30:00'), NOW)).toBe('내일 09:30');
  });

  it('이번 주말이면 "M/D (요일) HH:MM" 형식으로 표시', () => {
    // 2026-05-23 은 토요일
    expect(formatMeetAt(new Date('2026-05-23T14:00:00'), NOW)).toBe('5/23 (토) 14:00');
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
