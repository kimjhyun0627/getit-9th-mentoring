/**
 * hobby-web 공용 상수 (#541).
 *
 * 분리 이유: 여러 컴포넌트에서 참조하는 외부 URL / 상수의 단일 출처 (DRY).
 */

/**
 * 학교 메일 인증 진입 URL — auth-web 마이페이지의 학교 연동 카드 자동 강조.
 *
 * - `focus=school-link` 쿼리는 auth-web `/me` 에서 학교 연동 카드 자동 스크롤 +
 *   시각 강조 트리거 (PRD `.claude/projects/school-auth.md` "hobby 안내 카피 — `?focus=school-link` 쿼리 처리").
 * - SchoolAuthBanner CTA 와 PostDetailPage 신청 잠금 링크가 동일 URL 사용 — 한 곳만 바뀌어도
 *   불일치 없도록 상수로 중앙화 (CR/Gemini review #549).
 */
export const SCHOOL_AUTH_URL = 'https://auth.get-it.cloud/me?focus=school-link';
