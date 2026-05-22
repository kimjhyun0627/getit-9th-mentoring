import { describe, expect, it } from 'vitest';

import { formatJoinedAt } from './format-date.js';

describe('formatJoinedAt', () => {
  it('ISO-8601 을 UTC YYYY-MM-DD 로 자른다', () => {
    expect(formatJoinedAt('2026-05-01T09:00:00Z')).toBe('2026-05-01');
  });

  it('자정 직전 (23:59:59Z) 은 같은 날 (UTC 기준)', () => {
    expect(formatJoinedAt('2026-05-01T23:59:59Z')).toBe('2026-05-01');
  });

  it('milliseconds 가 붙어도 동작한다', () => {
    expect(formatJoinedAt('2026-05-01T09:00:00.123Z')).toBe('2026-05-01');
  });

  it('타임존 오프셋 (KST +09:00) 도 UTC 로 정규화한다', () => {
    // 2026-05-01T08:00:00+09:00 → UTC 2026-04-30T23:00:00Z → '2026-04-30'
    expect(formatJoinedAt('2026-05-01T08:00:00+09:00')).toBe('2026-04-30');
  });

  it('파싱 실패 (not-a-date) 면 em dash', () => {
    expect(formatJoinedAt('not-a-date')).toBe('—');
  });

  it('undefined / null / 빈 문자열 → em dash', () => {
    expect(formatJoinedAt(undefined)).toBe('—');
    expect(formatJoinedAt(null)).toBe('—');
    expect(formatJoinedAt('')).toBe('—');
  });

  it('string 이 아닌 타입 → em dash', () => {
    expect(formatJoinedAt(12345)).toBe('—');
    expect(formatJoinedAt({})).toBe('—');
  });
});
