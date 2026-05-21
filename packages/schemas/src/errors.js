/**
 * Zod 에러 → API 응답 바디 직렬화 공용 helper.
 *
 * 이전엔 5개 API 앱 (auth/hobby/board/letter/shelf) 라우터마다
 * 동일 구현이 14곳 중복돼 있었음 — 단일 진실 공급원으로 통일.
 *
 * 응답 포맷:
 *   { error: 'ValidationError', issues: [{ path, message }] }
 *
 * - `path` 는 zod issue path 배열을 dot-notation 문자열로 합침 (예: `address.city`).
 * - `issues` 는 zod 가 보고한 모든 위반을 순서대로 보존.
 *
 * @param {import('zod').ZodError} err - safeParse 실패 시의 `.error`.
 * @returns {{ error: 'ValidationError', issues: { path: string, message: string }[] }}
 */
export const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});
