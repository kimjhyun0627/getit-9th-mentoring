/**
 * letter 스키마 단위 테스트.
 */
import { describe, expect, it } from 'vitest';

import { MessageColor, MessageCreateInput, MessageIdParam, MessageUpdateInput } from './letter.js';

describe('MessageColor', () => {
  it('4색 enum 정확히 통과', () => {
    expect(MessageColor.parse('PINK')).toBe('PINK');
    expect(MessageColor.parse('MINT')).toBe('MINT');
    expect(MessageColor.parse('LEMON')).toBe('LEMON');
    expect(MessageColor.parse('LAVENDER')).toBe('LAVENDER');
  });

  it('다른 색상 reject', () => {
    expect(() => MessageColor.parse('RED')).toThrow();
    expect(() => MessageColor.parse('pink')).toThrow();
  });
});

describe('MessageCreateInput', () => {
  it('정상 입력 통과', () => {
    const out = MessageCreateInput.parse({ content: '안녕!', color: 'PINK' });
    expect(out).toEqual({ content: '안녕!', color: 'PINK' });
  });

  it('content trim', () => {
    const out = MessageCreateInput.parse({ content: '  hi  ', color: 'MINT' });
    expect(out.content).toBe('hi');
  });

  it('빈 content reject', () => {
    expect(() => MessageCreateInput.parse({ content: '   ', color: 'PINK' })).toThrow();
  });

  it('501자 content reject', () => {
    const long = 'a'.repeat(501);
    expect(() => MessageCreateInput.parse({ content: long, color: 'PINK' })).toThrow();
  });

  it('색상 누락 reject', () => {
    expect(() => MessageCreateInput.parse({ content: 'hi' })).toThrow();
  });
});

describe('MessageUpdateInput', () => {
  it('content만 → 통과', () => {
    expect(MessageUpdateInput.parse({ content: '수정' })).toEqual({ content: '수정' });
  });

  it('color만 → 통과', () => {
    expect(MessageUpdateInput.parse({ color: 'LEMON' })).toEqual({ color: 'LEMON' });
  });

  it('둘 다 누락 → reject', () => {
    expect(() => MessageUpdateInput.parse({})).toThrow();
  });

  // #302 — max(500) 한국어 메시지 일관성.
  it('501자 content reject + 한국어 메시지', () => {
    const long = 'a'.repeat(501);
    const result = MessageUpdateInput.safeParse({ content: long });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === 'content')?.message;
      expect(msg).toBe('메시지는 500자 이내');
    }
  });
});

describe('MessageIdParam', () => {
  it('정상 id 통과', () => {
    expect(MessageIdParam.parse({ id: 'abc123' })).toEqual({ id: 'abc123' });
  });

  it('빈 id reject', () => {
    expect(() => MessageIdParam.parse({ id: '' })).toThrow();
  });
});
