/**
 * prisma/seed.js 의 production 안전 가드 검증.
 *
 * seed 는 deleteMany 로 DB 전체를 날리므로 production 에서는
 * SEED_CONFIRM=YES 가 명시되어야만 실행돼야 한다.
 *
 * 가드 함수(`shouldAllowSeed`)는 seed.js 에서 export 한 실제 구현을
 * import 해서 검증한다 — 로직이 바뀌어도 회귀를 잡을 수 있도록.
 */
import { describe, expect, it } from 'vitest';

import { shouldAllowSeed } from '../prisma/seed.js';

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
