/**
 * Auth 라우터 — signup / login / logout / refresh / me.
 *
 * - 입력 검증: `@getit/schemas/auth` 의 LoginInput, SignupInput
 * - 비밀번호: bcrypt cost = `BCRYPT_COST` (기본 12)
 * - access: JWT (`@getit/auth-utils/server` signJwt)
 * - refresh: opaque 토큰 + SHA-256 해시만 DB에 저장 → 회전
 * - 쿠키: HttpOnly, SameSite=Lax, prod에선 Secure, `.get-it.cloud`
 */
import { requireAuth } from '@getit/auth-utils/server';
import { LoginInput, SignupInput } from '@getit/schemas/auth';
import bcrypt from 'bcrypt';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  readAuthEnv,
  setAuthCookies,
} from '../lib/tokens.js';

const BCRYPT_COST = Number.parseInt(process.env.BCRYPT_COST ?? '12', 10);

/**
 * Zod 에러를 400 응답 본문으로 변환.
 *
 * @param {import('zod').ZodError} err
 * @returns {{ error: string, issues: Array<{ path: string, message: string }> }}
 */
const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

/**
 * User 객체에서 응답에 안전한 필드만 추려서 반환 (passwordHash 절대 노출 X).
 *
 * @param {{ id: string, email: string, name: string }} user
 * @returns {{ sub: string, email: string, name: string }}
 */
const publicUser = (user) => ({ sub: user.id, email: user.email, name: user.name });

/**
 * access + refresh 토큰 발급 + DB 저장 + 쿠키 set 까지 한 번에.
 *
 * `tx` 가 주어지면 그 트랜잭션 컨텍스트에서 refresh token 을 생성한다.
 * (signup/login 등에서 사용자 생성과 같이 묶을 수 있도록.)
 *
 * @param {{ id: string, email: string, name: string }} user
 * @param {import('express').Response} res
 * @param {{ refreshToken: { create: typeof prisma.refreshToken.create } }} [tx]
 */
const issueTokensAndCookies = async (user, res, tx) => {
  const cfg = readAuthEnv();
  const client = tx ?? prisma;
  const accessToken = generateAccessToken(
    { sub: user.id, email: user.email, name: user.name },
    cfg.jwtSecret,
    cfg.accessTtl,
  );
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + cfg.refreshTtlDays * 24 * 60 * 60 * 1000);
  await client.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
  });
  setAuthCookies(res, { accessToken, refreshToken }, cfg);
  return { accessToken, refreshToken };
};

// Prisma unique constraint violation code.
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/**
 * 인증 라우터 생성.
 *
 * @param {{ signupLimiter: import('express').RequestHandler, loginLimiter: import('express').RequestHandler }} opts
 * @returns {import('express').Router}
 */
export const createAuthRouter = ({ signupLimiter, loginLimiter }) => {
  const router = Router();
  const cfg = readAuthEnv();

  // POST /api/signup
  router.post('/signup', signupLimiter, async (req, res, next) => {
    try {
      const parsed = SignupInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const { email, password, name } = parsed.data;
      // 사전 조회로 명시 충돌 메시지 + 동시성 race 는 P2002 catch 로 백업.
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: 'EmailAlreadyInUse' });

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

      // user.create + refreshToken.create 를 한 트랜잭션으로 묶어
      // 토큰 발급 실패 시 사용자 레코드도 롤백 → 가입 프로세스 일관성.
      let user;
      try {
        user = await prisma.$transaction(async (tx) => {
          const created = await tx.user.create({ data: { email, name, passwordHash } });
          await issueTokensAndCookies(created, res, tx);
          return created;
        });
      } catch (err) {
        if (err?.code === PRISMA_UNIQUE_VIOLATION) {
          return res.status(409).json({ error: 'EmailAlreadyInUse' });
        }
        throw err;
      }
      return res.status(201).json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/login
  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const parsed = LoginInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(401).json({ error: 'InvalidCredentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'InvalidCredentials' });

      await issueTokensAndCookies(user, res);
      return res.status(200).json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/refresh — 토큰 회전 (원자적 + reuse-detection)
  router.post('/refresh', async (req, res, next) => {
    try {
      const raw = req.cookies?.[REFRESH_COOKIE];
      if (!raw) return res.status(401).json({ error: 'NoRefreshToken' });

      const tokenHash = hashRefreshToken(raw);
      // 조건부 revoke: revokedAt IS NULL AND expiresAt > now 일 때만 1건 갱신.
      // 두 개의 동시 요청이 같은 토큰을 사용해도 단 하나만 count=1 을 받는다.
      const { count } = await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });

      if (count !== 1) {
        // 토큰이 이미 revoked 거나 만료/존재하지 않는다.
        // revoked 였다면 reuse-attack 가능성 → 해당 유저의 모든 활성 토큰 강제 무효화.
        const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
        if (stored?.revokedAt) {
          await prisma.refreshToken
            .updateMany({
              where: { userId: stored.userId, revokedAt: null },
              data: { revokedAt: new Date() },
            })
            .catch(() => null);
        }
        clearAuthCookies(res, cfg);
        return res.status(401).json({ error: 'InvalidRefreshToken' });
      }

      // revoke 성공 후 유저 조회 + 새 토큰 발급.
      const revoked = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      const user = revoked ? await prisma.user.findUnique({ where: { id: revoked.userId } }) : null;
      if (!user) {
        clearAuthCookies(res, cfg);
        return res.status(401).json({ error: 'UserNotFound' });
      }

      await issueTokensAndCookies(user, res);
      return res.status(200).json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/logout — 토큰 revoke + 쿠키 clear
  router.post('/logout', async (req, res, next) => {
    try {
      const raw = req.cookies?.[REFRESH_COOKIE];
      if (raw) {
        await prisma.refreshToken
          .updateMany({
            where: { tokenHash: hashRefreshToken(raw) },
            data: { revokedAt: new Date() },
          })
          .catch(() => null);
      }
      clearAuthCookies(res, cfg);
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/me — 현재 사용자 정보
  router.get('/me', requireAuth({ secret: cfg.jwtSecret }), (req, res) => {
    return res.status(200).json({ user: req.user });
  });

  return router;
};

export { ACCESS_COOKIE, REFRESH_COOKIE };
