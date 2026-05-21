import { describe, expect, it } from 'vitest';

import { formatRelative, rotationFromId } from './time.js';

describe('formatRelative', () => {
  const now = new Date('2026-05-19T12:00:00.000Z');

  it('빈 값/잘못된 값은 빈 문자열', () => {
    expect(formatRelative(null, now)).toBe('');
    expect(formatRelative(undefined, now)).toBe('');
    expect(formatRelative('not-a-date', now)).toBe('');
  });

  it('2분 미만이면 "방금 전" (#453 — BE minute truncate 보정)', () => {
    // 30초 전 — 방금 전
    expect(formatRelative('2026-05-19T11:59:30.000Z', now)).toBe('방금 전');
    // 1분 5초 전 — BE truncate 보정으로 여전히 "방금 전"
    expect(formatRelative('2026-05-19T11:58:55.000Z', now)).toBe('방금 전');
  });

  it('2분 이상이면 분 단위로 표시', () => {
    expect(formatRelative('2026-05-19T11:58:00.000Z', now)).toBe('2분 전');
  });

  it('1시간 미만이면 분 단위', () => {
    expect(formatRelative('2026-05-19T11:55:00.000Z', now)).toBe('5분 전');
  });

  it('1일 미만이면 시간 단위', () => {
    expect(formatRelative('2026-05-19T09:00:00.000Z', now)).toBe('3시간 전');
  });

  it('1주 미만이면 일 단위', () => {
    expect(formatRelative('2026-05-17T12:00:00.000Z', now)).toBe('2일 전');
  });

  it('1주 이상이면 주 단위 (5주 미만)', () => {
    expect(formatRelative('2026-05-05T12:00:00.000Z', now)).toBe('2주 전');
  });

  it('5주 이상이면 YYYY-MM-DD 형식으로 떨어진다 (en-CA 로케일 fallback)', () => {
    // 5주(35일) 보다 충분히 오래된 시각 → toLocaleDateString('en-CA') 경로.
    // en-CA 는 ISO 형식 (YYYY-MM-DD) 을 항상 보장하므로 정규식으로 검증.
    const result = formatRelative('2026-03-01T12:00:00.000Z', now);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('rotationFromId', () => {
  it('빈 값은 0', () => {
    expect(rotationFromId('')).toBe(0);
    // @ts-expect-error 의도적 잘못된 타입 — 가드 검증.
    expect(rotationFromId(null)).toBe(0);
  });

  it('같은 ID 는 항상 같은 각도 (deterministic)', () => {
    expect(rotationFromId('abc123')).toBe(rotationFromId('abc123'));
  });

  it('-3 ~ +3 범위 내', () => {
    for (const id of ['a', 'bb', 'cuid-xyz', 'long-message-id-1234567890']) {
      const r = rotationFromId(id);
      expect(r).toBeGreaterThanOrEqual(-3);
      expect(r).toBeLessThanOrEqual(3);
    }
  });
});
