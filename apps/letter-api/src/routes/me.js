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
 * 다른 BE (hobby-api, board-api 등) 도 같은 fallback 의 잠재 희생자라 패턴 통일 가치.
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
  router.get('/me', auth, (req, res) => {
    return res.status(200).json({ user: req.user });
  });

  return router;
};
