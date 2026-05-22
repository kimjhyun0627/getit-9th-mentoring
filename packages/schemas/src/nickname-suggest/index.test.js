/**
 * `randomNicknameSuggestion` 단위 테스트 (Issue #557).
 */
import { describe, it, expect } from 'vitest';

import { NicknameValue } from '../auth.js';

import { ADJECTIVES, NOUNS, randomNicknameSuggestion } from './index.js';

describe('nickname-suggest dataset', () => {
  it('형용사 100개 + unique', () => {
    expect(ADJECTIVES.length).toBe(100);
    expect(new Set(ADJECTIVES).size).toBe(100);
  });

  it('명사 100개 + unique', () => {
    expect(NOUNS.length).toBe(100);
    expect(new Set(NOUNS).size).toBe(100);
  });

  it('모든 단어가 닉네임 정규식 통과 (한글/영문/숫자/-/_)', () => {
    for (const word of [...ADJECTIVES, ...NOUNS]) {
      // 단어 단위 + 공백 없으므로 단어 그대로 검증.
      expect(word).toMatch(/^[A-Za-z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_]+$/u);
    }
  });
});

describe('randomNicknameSuggestion()', () => {
  it('형용사 + 명사 결합 (공백 없음)', () => {
    // 결정론적 rng: 항상 0 → 첫 형용사 + 첫 명사.
    const r = randomNicknameSuggestion(() => 0);
    expect(r).toBe(`${ADJECTIVES[0]}${NOUNS[0]}`);
    expect(r).not.toContain(' ');
  });

  it('rng 의 마지막 인덱스 위치 (0.999) → 마지막 형용사+명사', () => {
    const r = randomNicknameSuggestion(() => 0.999);
    expect(r).toBe(`${ADJECTIVES[99]}${NOUNS[99]}`);
  });

  it('결과가 항상 NicknameValue 검증 통과', () => {
    // 100 회 random sampling — 모든 조합이 NicknameValue 스키마 (2-20자 + 정규식) 통과해야 한다.
    for (let i = 0; i < 100; i += 1) {
      const r = randomNicknameSuggestion();
      const parsed = NicknameValue.safeParse(r);
      if (!parsed.success) {
        throw new Error(`Generated nickname failed validation: ${r}`);
      }
    }
  });

  it('기본 rng (Math.random) 사용 시에도 문자열을 반환', () => {
    const r = randomNicknameSuggestion();
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });
});
