/**
 * displayName — 사용자명 표시 우선순위 헬퍼 (school-auth #540).
 *
 * 정책 (PRD): `user.nickname > user.name (fallback) > 빈 문자열`.
 * 6 web 의 header / mypage / 카드 등 사용자 표시 지점에서 같은 헬퍼로 통일.
 */
import { describe, expect, it } from 'vitest';

import { displayName } from './displayName.js';

describe('displayName', () => {
  it('nickname 있으면 nickname 그대로', () => {
    expect(displayName({ nickname: '길동이', name: '홍길동' })).toBe('길동이');
  });

  it('nickname null → name fallback', () => {
    expect(displayName({ nickname: null, name: '홍길동' })).toBe('홍길동');
  });

  it('nickname undefined → name fallback', () => {
    expect(displayName({ name: '홍길동' })).toBe('홍길동');
  });

  it('nickname 빈 문자열 → name fallback (보호용)', () => {
    expect(displayName({ nickname: '', name: '홍길동' })).toBe('홍길동');
  });

  it('nickname 빈 문자열 + 공백 → name fallback', () => {
    expect(displayName({ nickname: '   ', name: '홍길동' })).toBe('홍길동');
  });

  it('둘 다 없으면 빈 문자열 (default)', () => {
    expect(displayName({})).toBe('');
  });

  it('둘 다 없을 때 호출자 fallback 지정 가능', () => {
    expect(displayName({}, '익명')).toBe('익명');
  });

  it('null user → 빈 문자열', () => {
    expect(displayName(null)).toBe('');
  });

  it('undefined user → 빈 문자열', () => {
    expect(displayName(undefined)).toBe('');
  });

  it('비객체 user → 빈 문자열 (panic 없음)', () => {
    expect(displayName('홍길동')).toBe('');
  });

  it('nickname trim 후 비어있지 않으면 그대로 (trim 적용 X)', () => {
    // nickname 자체에 공백이 있어도 표시 시점에선 원본 보존.
    expect(displayName({ nickname: ' 길동 ' })).toBe(' 길동 ');
  });
});
