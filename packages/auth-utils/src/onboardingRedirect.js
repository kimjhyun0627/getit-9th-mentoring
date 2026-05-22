/**
 * onboardingRedirect — nickname onboarding 강제 redirect 빌더 + 가드 (#540).
 *
 * 5 web (`hobby` / `shelf` / `board` / `letter` 가 실 사용자, `auth-web` 자체는
 * onboarding 페이지 보유자, `landing` 은 PRD 에서 강제 redirect 제외)
 * 에서 같은 로직 반복하지 않도록 공용 헬퍼.
 *
 * 의도:
 *   - 로그인 + nickname == null 사용자가 어떤 page 에 들어와도 onboarding 으로 보냄.
 *   - 단 사용자가 이미 onboarding 페이지에 있거나 비로그인이면 redirect X.
 *   - redirect 값은 `safeRedirect` 통과한 값만 — open redirect 방어.
 */
import { safeRedirect } from './safeRedirect.js';

const ONBOARDING_PATH = '/onboarding/nickname';

/**
 * @param {string} authOrigin trailing slash 있어도 무시.
 * @returns {string}
 */
const normalizeAuthOrigin = (authOrigin) =>
  typeof authOrigin === 'string' ? authOrigin.replace(/\/+$/, '') : '';

/**
 * @param {{ authOrigin: string; currentUrl: string }} opts
 * @returns {string}
 */
export const buildNicknameOnboardingUrl = ({ authOrigin, currentUrl }) => {
  const origin = normalizeAuthOrigin(authOrigin);
  // currentUrl 도 allowlist 검증 — open redirect 방어. allowlist 밖이면 safe default 로 떨어짐.
  const safeBack = safeRedirect(currentUrl);
  const params = new URLSearchParams({ redirect: safeBack });
  return `${origin}${ONBOARDING_PATH}?${params.toString()}`;
};

/**
 * `enforced` 플래그 (PRD `NICKNAME_ONBOARDING_ENFORCED` 결함 시 OFF — 데이터는
 * 보존하고 동작만 비활성화) 가 false 면 가드 자체를 skip. 기본 true.
 *
 * @param {{
 *   user: { nickname?: string | null } | null | undefined;
 *   currentPath: string;
 *   enforced?: boolean;
 * }} opts
 * @returns {boolean}
 */
export const shouldEnforceNicknameOnboarding = ({ user, currentPath, enforced = true }) => {
  if (!enforced) return false;
  if (!user) return false;
  const nickname = /** @type {{ nickname?: unknown }} */ (user).nickname;
  const hasNickname = typeof nickname === 'string' && nickname.trim().length > 0;
  if (hasNickname) return false;
  // onboarding 자체 페이지면 무한 루프 방지.
  if (typeof currentPath === 'string' && currentPath.startsWith(ONBOARDING_PATH)) {
    return false;
  }
  return true;
};

export { ONBOARDING_PATH };
