/**
 * 닉네임 자동추천 — DB unique 충돌 시 숫자 suffix (Issue #557).
 *
 * - random `A하는B` 패턴 base 생성 (`@getit/schemas/nickname-suggest`).
 * - DB 에 이미 같은 nickname 이 있으면 `${base}2`, `${base}3` … 시도.
 *   - max suffix = 100 (2..100 → 99 회 시도). 그래도 못 찾으면 새 base random retry.
 *   - max base retry = 5.
 * - 결과 nickname 은 `NicknameValue` 정규식/길이 항상 통과 (suffix 포함해도 20자 이내 유지).
 *
 * Base length budget: 형용사 최대 6자 + 명사 최대 5자 ≈ 11자. + suffix 3자 → 14자 ≤ 20자 OK.
 *
 * Gemini 피드백 #557 적용: 루프 안에서 `findUnique` 를 100회 반복하는 대신
 * `findMany({ where: { nickname: { startsWith: base } } })` 로 1회 batch 조회 후
 * 메모리 Set 으로 가용성 검사 → DB 왕복 ≤ 5회 (base retry 횟수).
 */
import { randomNicknameSuggestion } from '@getit/schemas/nickname-suggest';

/**
 * @typedef {{
 *   user: {
 *     findMany: (args: {
 *       where: { nickname: { startsWith: string } },
 *       select: { nickname: true },
 *     }) => Promise<Array<{ nickname: string | null }>>,
 *   },
 * }} NicknameLookup
 */

/** suffix 시도 최대치 (포함). 2..MAX_SUFFIX. */
const MAX_SUFFIX = 100;
/** base 재추첨 최대 횟수. */
const MAX_BASE_RETRY = 5;

/**
 * DB unique 보장 nickname 생성.
 *
 * @param {NicknameLookup} prismaLike — `prisma` 또는 트랜잭션 컨텍스트.
 * @param {() => string} [generateBase] — 테스트용 base 생성기 (`randomNicknameSuggestion` 기본).
 * @returns {Promise<string>}
 */
export const findAvailableNickname = async (
  prismaLike,
  generateBase = randomNicknameSuggestion,
) => {
  for (let attempt = 0; attempt < MAX_BASE_RETRY; attempt += 1) {
    const base = generateBase();
    // base 로 시작하는 모든 닉네임을 한 번에 조회 (`findMany` 1회) → 메모리에서 가용성 검사.
    // eslint-disable-next-line no-await-in-loop
    const existing = await prismaLike.user.findMany({
      where: { nickname: { startsWith: base } },
      select: { nickname: true },
    });
    const taken = new Set(existing.map((u) => u.nickname).filter(Boolean));
    if (!taken.has(base)) return base;
    for (let i = 2; i <= MAX_SUFFIX; i += 1) {
      const candidate = `${base}${i}`;
      if (!taken.has(candidate)) return candidate;
    }
    // 같은 base 가 1..100 까지 다 차면 새 base 재추첨.
  }
  // 매우 비현실적 — 5번 base 재추첨 + 각각 100 suffix 다 차 있는 경우.
  // race 가 마지막에 P2002 로 잡아주므로 여기 도달해도 fallback 으로 timestamp 붙임.
  return `${generateBase()}${Date.now().toString().slice(-4)}`;
};
