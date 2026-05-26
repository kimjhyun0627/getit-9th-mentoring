/**
 * letter-api /me 라우터 — 현재 로그인 사용자 정보 echo.
 *
 * 배경:
 *  - FE `apps/letter-web/src/pages/BoardPage.jsx` 가 mount 시 `api.getMe()` 호출.
 *  - production build 에 `VITE_AUTH_API_URL` 가 안 박혀서 fallback `/api` 로 떨어지면
 *    `GET https://letter.get-it.cloud/api/me` 가 Traefik 을 통해 letter-api 로 라우팅됨.
 *  - letter-api 에 `/me` 라우터가 없으면 → 404. 401 이 아니라서 FE 의
 *    `setUnauthorizedHandler` 가 발화 안 함 → BoardPage 가 SSO redirect 못 받고 stuck.
 *
 * 해결:
 *  - auth-api 의 `GET /api/me` 와 동일한 컨트랙트로 letter-api 에서도 응답한다.
 *  - JWT 가 없거나 invalid → 401 (FE 의 401 핸들러가 SSO redirect 처리).
 *  - JWT 가 valid → 200 + `{ user: req.user }` (auth-api 와 동일한 응답 모양).
 *
 * 무한 redirect fix:
 *  - JWT payload 가 nickname / schoolVerifiedAt 를 포함하므로 응답에도 echo 한다.
 *  - 키 누락 시 FE NicknameOnboardingGuard 가 onboarding 페이지로 redirect → 사용자가
 *    nickname 설정 → letter 복귀 → 또 누락 → 무한 루프. 명시적 null 로 응답해서
 *    `shouldEnforceNicknameOnboarding` 가 정확한 판정 가능.
 *
 * 다른 BE (hobby-api, board-api 등) 도 같은 fallback 의 잠재 희생자라 패턴 통일.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { Router } from 'express';

/**
 * `/me` 라우터 생성. messages.js 의 factory 패턴과 동일.
 *
 * @param {{ jwtSecret: string }} opts
 * @returns {import('express').Router}
 */
export const createMeRouter = ({ jwtSecret }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });

  // GET /api/me — 현재 사용자 정보 echo (auth-api 와 동일한 컨트랙트).
  // JWT 표준 메타데이터(iat, exp 등) 가 외부로 누출되지 않도록 명시적 화이트리스트.
  // nickname/schoolVerifiedAt 는 JWT payload 에 있을 때만 키 동봉, 없으면 null 로
  // 일관성 확보 (FE auth-utils 의 shouldEnforceNicknameOnboarding 와 컨트랙트 일치).
  //
  // #571: studentIdLegacy 도 echo. JWT payload 에 박혀 있으면 (DB studentId 8자리)
  // true. 없거나 false 면 false 로 명시. FE 의 hobby/letter 가드가 이 플래그로
  // blocking 모달 노출 여부 판단 — 명시적 boolean 으로 일관성 확보.
  router.get('/me', auth, (req, res) => {
    const { sub, email, name, nickname, schoolVerifiedAt, studentIdLegacy } = req.user;
    return res.status(200).json({
      user: {
        sub,
        email,
        name,
        nickname: nickname ?? null,
        schoolVerifiedAt: schoolVerifiedAt ?? null,
        studentIdLegacy: studentIdLegacy === true,
      },
    });
  });

  return router;
};
