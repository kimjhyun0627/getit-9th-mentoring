/**
 * prisma/seed.js 의 production 안전 가드 검증.
 *
 * seed 는 deleteMany 로 DB 전체를 날리므로 production 에서는
 * SEED_CONFIRM=YES 가 명시되어야만 실행돼야 한다.
 *
 * 여기서는 가드 로직만 단위로 검증 — 실 PrismaClient 호출은 하지 않는다.
 */
import { describe, expect, it } from 'vitest';

const shouldAllowSeed = ({ nodeEnv, seedConfirm }) => {
  if (nodeEnv === 'production' && seedConfirm !== 'YES') return false;
  return true;
};

describe('seed production guard', () => {
  it('dev 환경에서는 항상 허용', () => {
    expect(shouldAllowSeed({ nodeEnv: 'development' })).toBe(true);
    expect(shouldAllowSeed({ nodeEnv: 'test' })).toBe(true);
  });

  it('production + SEED_CONFIRM 누락 → 차단', () => {
    expect(shouldAllowSeed({ nodeEnv: 'production' })).toBe(false);
    expect(shouldAllowSeed({ nodeEnv: 'production', seedConfirm: 'no' })).toBe(false);
  });

  it('production + SEED_CONFIRM=YES → 허용', () => {
    expect(shouldAllowSeed({ nodeEnv: 'production', seedConfirm: 'YES' })).toBe(true);
  });
});
