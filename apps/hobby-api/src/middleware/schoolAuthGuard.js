/**
 * 학교 인증 가드 미들웨어 (Issue #541, PRD `.claude/projects/school-auth.md`).
 *
 * 정책:
 *  - hobby 의 **모든 mutation** (POST / PATCH / PUT / DELETE) 에 적용.
 *  - GET 은 통과 — 외부인도 둘러보기 OK (PRD 디폴트).
 *  - 라우터 단위가 아닌 method 기반 — 신규 mutation 라우터 누락 방지.
 *
 * 동작:
 *  1. mutation method 가 아니면 즉시 통과.
 *  2. JWT 직접 파싱 (cookie / Authorization). 토큰 없거나 invalid 면 통과 — 개별
 *     라우터의 requireAuth 가 401 처리해야 함 (가드는 학교 인증만 책임).
 *  3. `schoolVerifiedAt` 이 truthy 면 통과, 아니면 403.
 *
 * Feature flag:
 *  - `SCHOOL_AUTH_GUARD_ENABLED=true` 일 때만 실제 차단.
 *  - false / unset 면 미들웨어 자체가 no-op (롤아웃 안전판).
 *
 * 응답 (차단 시):
 *   403 { error: 'SchoolVerificationRequired', message: '학교 인증이 필요합니다.' }
 *
 * Stale 토큰 한계:
 *  - JWT access TTL 동안 (기본 15m) 갓 인증 완료한 사용자는 schoolVerifiedAt 없는
 *    옛 토큰을 들고 있을 수 있음. 이 경우 refresh 또는 재로그인 후 통과.
 *  - PRD 가 real-time 보장 요구하지 않으므로 허용.
 */
import { COOKIE_NAME, verifyJwt } from '@getit/auth-utils/server';
import { z } from 'zod';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

// CR #549: truthy 만으론 부족 — `'not-a-date'`, `1`, `{}` 같은 값도 통과해 권한 우회.
// 권한 분기이므로 ISO datetime 형식까지 검증한다.
// JwtPayload 스키마가 같은 검증을 하지만 verifyJwt 통과 후에도 명시 재검증으로 방어층 추가.
const schoolVerifiedAtSchema = z.string().datetime();

/**
 * 학교 인증 가드 미들웨어 팩토리.
 *
 * @param {{ jwtSecret: string, enabled?: boolean }} opts
 *   - `jwtSecret`: JWT 검증용 secret. 호출자가 readJwtSecret() 결과 주입.
 *   - `enabled`: 명시 지정 시 env 무시. 테스트에서 ON/OFF 토글 용.
 *     생략 시 `process.env.SCHOOL_AUTH_GUARD_ENABLED === 'true'` 로 판단.
 * @returns {import('express').RequestHandler}
 */
export const schoolAuthGuard = ({ jwtSecret, enabled }) => {
  const envFlag = process.env.SCHOOL_AUTH_GUARD_ENABLED === 'true';
  const isEnabled = enabled ?? envFlag;

  return (req, res, next) => {
    if (!isEnabled) return next();
    if (!MUTATING_METHODS.has(req.method)) return next();

    // JWT 직접 파싱 — requireAuth 와 같은 cookie / Bearer 순.
    const cookieToken = req.cookies?.[COOKIE_NAME];
    const header = req.headers?.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const token = cookieToken ?? bearerToken;

    // 토큰 없거나 invalid → 개별 라우터의 requireAuth 가 401 책임. 가드는 통과.
    if (!token) return next();
    let payload;
    try {
      payload = verifyJwt(token, jwtSecret);
    } catch {
      return next();
    }

    if (schoolVerifiedAtSchema.safeParse(payload.schoolVerifiedAt).success) {
      return next();
    }
    return res.status(403).json({
      error: 'SchoolVerificationRequired',
      message: '학교 인증이 필요합니다.',
    });
  };
};
