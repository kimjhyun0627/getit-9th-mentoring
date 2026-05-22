/**
 * displayName — 사용자명 표시 우선순위 헬퍼 (school-auth #540).
 *
 * 6 web (`landing` / `auth-web` / `hobby-web` / `shelf-web` / `board-web` / `letter-web`)
 * 의 사용자명 표시 지점에서 공용으로 호출. 닉네임 정책 (PRD `nickname > name`) 을
 * 한 곳에 모아 fallback 룰 분기를 없앤다.
 *
 * 정책:
 *   - `nickname` 이 trim 후 비어있지 않으면 **원본** 그대로 (공백 유지) 반환.
 *   - 아니면 `name` 그대로 반환.
 *   - 둘 다 비어있으면 호출자 fallback (`''` default) 반환.
 *
 * trim 은 "비어있는지 판정" 에만 쓰고, 표시 자체는 원본 보존 — 사용자가 의도적으로
 * 입력한 공백이 있을 수 있다 (예: `' 길동 '` — 디자인상 padding).
 *
 * @param {{ nickname?: string | null; name?: string | null } | null | undefined} user
 * @param {string} [fallback]
 * @returns {string}
 */
export const displayName = (user, fallback = '') => {
  if (!user || typeof user !== 'object') return fallback;
  const nickname = /** @type {{ nickname?: unknown }} */ (user).nickname;
  if (typeof nickname === 'string' && nickname.trim().length > 0) {
    return nickname;
  }
  const name = /** @type {{ name?: unknown }} */ (user).name;
  if (typeof name === 'string' && name.length > 0) {
    return name;
  }
  return fallback;
};
