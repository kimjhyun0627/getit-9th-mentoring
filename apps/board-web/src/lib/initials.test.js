import { describe, expect, it } from 'vitest';

import { avatarTone, initials } from './initials.js';

describe('initials()', () => {
  it('한글 이름의 마지막 2글자를 반환한다', () => {
    expect(initials('김진현')).toBe('진현');
    expect(initials('박서연')).toBe('서연');
  });

  it('공백 포함 한글도 마지막 2글자를 반환한다', () => {
    expect(initials('김 진현')).toBe('진현');
  });

  it('영문 단어 2개 이상이면 각 단어의 첫 글자를 결합한다', () => {
    expect(initials('John Doe')).toBe('JD');
    expect(initials('alice bob carol')).toBe('AB');
  });

  it('영문 단일 단어이면 첫 2글자를 반환한다', () => {
    expect(initials('alice')).toBe('AL');
    expect(initials('z')).toBe('Z');
  });

  it('null/undefined/빈 문자열은 ?? 를 반환한다', () => {
    expect(initials(null)).toBe('??');
    expect(initials(undefined)).toBe('??');
    expect(initials('')).toBe('??');
    expect(initials('   ')).toBe('??');
  });
});

describe('avatarTone()', () => {
  it('같은 키엔 항상 같은 톤이 떨어진다 (결정적)', () => {
    const a = avatarTone('user-1');
    const b = avatarTone('user-1');
    expect(a).toBe(b);
  });

  it('빈 입력에도 유효한 톤을 반환한다', () => {
    const tone = avatarTone('');
    expect(tone).toMatch(/^bg-/);
  });
});
