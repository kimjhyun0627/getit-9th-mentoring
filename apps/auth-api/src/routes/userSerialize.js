/**
 * User → public API 응답 직렬화 헬퍼 (Issue #538).
 *
 * 정책:
 *  - `passwordHash`, `deletedAt` 같은 내부 컬럼은 절대 노출 X.
 *  - `id` 는 JWT 표준 `sub` 로 매핑.
 *  - 학교 인증 / nickname 필드 (#538) 까지 포함 — auth/me/school-verify
 *    어느 라우터에서 응답해도 동일한 shape 을 보장.
 *  - DateTime 필드는 Prisma 가 Date 객체로 주는 것을 그대로 둔다.
 *    JSON 직렬화 시 ISO 문자열로 변환되므로 클라이언트는 항상 string 으로 받음.
 *
 * 단일 진실 공급원 — auth.js / me.js / school-verify.js 가 모두 이걸 import.
 */

/**
 * Prisma User row → API 응답 user 객체.
 *
 * #571: `studentIdLegacy` 도 같이 응답. DB studentId 가 정확히 8자리면 true
 * (8 → 10자리 마이그레이션 필요), 그 외 (10자리 / null) 는 false.
 *  - auth-api `/me` 는 DB 진실로 직접 계산.
 *  - hobby/letter `/me` 는 자체 User 없어 JWT payload echo (buildAccessTokenPayload).
 *
 * @param {{
 *   id: string,
 *   email: string,
 *   name: string,
 *   emailVerifiedAt?: Date | null,
 *   nickname?: string | null,
 *   studentId?: string | null,
 *   schoolEmail?: string | null,
 *   schoolVerifiedAt?: Date | null,
 *   createdAt?: Date | null,
 * }} u
 * @returns {{
 *   sub: string,
 *   email: string,
 *   name: string,
 *   nickname: string | null,
 *   studentId: string | null,
 *   studentIdLegacy: boolean,
 *   schoolEmail: string | null,
 *   schoolVerifiedAt: Date | null,
 *   emailVerifiedAt: Date | null,
 *   createdAt: Date | null,
 * }}
 */
export const publicUser = (u) => ({
  sub: u.id,
  email: u.email,
  name: u.name,
  nickname: u.nickname ?? null,
  studentId: u.studentId ?? null,
  studentIdLegacy: typeof u.studentId === 'string' && u.studentId.length === 8,
  schoolEmail: u.schoolEmail ?? null,
  schoolVerifiedAt: u.schoolVerifiedAt ?? null,
  emailVerifiedAt: u.emailVerifiedAt ?? null,
  createdAt: u.createdAt ?? null,
});
