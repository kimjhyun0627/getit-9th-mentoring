/**
 * Auth 라우터 — signup / login / logout / refresh / me.
 *
 * - 입력 검증: `@getit/schemas/auth` 의 LoginInput, SignupInput
 * - 비밀번호: bcrypt cost = `BCRYPT_COST` (기본 12)
 * - access: JWT (`@getit/auth-utils/server` signJwt)
 * - refresh: opaque 토큰 + SHA-256 해시만 DB에 저장 → 회전
 * - 쿠키: HttpOnly, SameSite=Lax, prod에선 Secure, `.get-it.cloud`
 *
 * Phase 6c:
 *  - /api/me: JWT 검증 후 DB 재조회 → revoked/삭제된 user 차단 (Issue #308).
 *  - /api/refresh: refreshLimiter 적용 — 토큰 무차별 대입 방어 (Issue #329).
 *  - signup 직후 emailVerifyToken 발급 + 메일 stub 발송 (Issue #226).
 */
import crypto from 'node:crypto';

import { requireAuth } from '@getit/auth-utils/server';
import { LoginInput, SignupInput } from '@getit/schemas/auth';
import bcrypt from 'bcrypt';
import { Router } from 'express';

import { sendVerifyEmail } from '../lib/mailer.js';
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
 * Login 경로의 timing 누수 방어용 더미 hash (Issue #299).
 *
 * 미등록 이메일이 들어와도 동일 cost 의 bcrypt.compare 를 1회 실행시켜
 * "이 이메일이 등록되어 있는가" 를 응답 시간으로 판별 불가하게 만든다.
 *
 * 운영 BCRYPT_COST 변경 시 부팅마다 새로 생성되며, 실제 비밀번호와
 * 충돌할 확률은 0 (랜덤 64-hex 입력 hash). 동기 호출이라 부팅에 ~300ms
 * (cost=12 기준) 추가되지만 1회뿐이라 허용.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_COST);

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
 * @param {{
 *   signupLimiter: import('express').RequestHandler,
 *   loginLimiter: import('express').RequestHandler,
 *   refreshLimiter?: import('express').RequestHandler,
 * }} opts
 * @returns {import('express').Router}
 */
export const createAuthRouter = ({ signupLimiter, loginLimiter, refreshLimiter }) => {
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

      // Issue #226: 이메일 인증 토큰 발급 + 발송 (fire-and-forget).
      // 발송 실패는 signup 실패로 이어지지 않는다 — UX 우선.
      try {
        const verifyToken = generateRefreshToken();
        const verifyHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.emailVerifyToken.create({
          data: { userId: user.id, tokenHash: verifyHash, expiresAt },
        });
        const base = process.env.AUTH_WEB_URL ?? 'https://auth.get-it.cloud';
        const verifyUrl = `${base}/verify-email?token=${verifyToken}`;
        sendVerifyEmail({ to: user.email, verifyUrl }).catch(() => null);
      } catch (err) {
        req.log?.warn?.({ err: String(err), userId: user.id }, 'verify email send failed');
      }

      return res.status(201).json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/login
  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      // #432: login 의 ValidationError 는 비밀번호 길이/정책을 노출 (`8자 이상` 등) →
      // 봇/공격자에게 정책 누설 + UX 측면 "비번 잘못 입력" 과 분리될 이유가 없다.
      // → ValidationError 도 401 InvalidCredentials 로 collapse (단일 응답).
      // signup/reset 은 강한 정책 가이드 유지 (사용자 가이드용).
      const parsed = LoginInput.safeParse(req.body);
      if (!parsed.success) return res.status(401).json({ error: 'InvalidCredentials' });

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      // 사용자 존재 여부와 무관하게 bcrypt.compare 1회 실행 → 응답 시간 일정화
      // (Issue #299 — email enumeration via timing leak 방어).
      // 미존재 시 더미 hash 와 비교: 결과는 항상 false 이지만 시간은 동일.
      const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
      const ok = await bcrypt.compare(password, passwordHash);
      if (!user || !ok) return res.status(401).json({ error: 'InvalidCredentials' });

      await issueTokensAndCookies(user, res);
      return res.status(200).json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/refresh — 토큰 회전 (원자적 + reuse-detection)
  // #329: 무차별 대입 방어용 rate-limit (옵션 — 테스트에선 비워둠).
  const refreshMw = refreshLimiter ? [refreshLimiter] : [];
  router.post('/refresh', ...refreshMw, async (req, res, next) => {
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

  // GET /api/me — 현재 사용자 정보.
  // #308: JWT 만 검증하면 revoke/삭제된 user 도 access TTL 동안 통과.
  // → JWT 통과 후 DB 재조회로 deletedAt 검사. (성능 영향 있음 → Redis 캐시는 follow-up).
  //
  // Cache-Control: no-store — 인증 응답은 캐시 금지. 라이브 버그(landing 304):
  // express 의 default ETag 매칭으로 동일 응답 시 304(body 없음) 반환 → fetch 클라이언트
  // (useSession) 가 res.json() 에서 throw → catch 로 user=null → 로그인 상태 손실.
  // no-store 헤더로 ETag 매칭/조건부 요청 자체를 차단.
  router.get('/me', requireAuth({ secret: cfg.jwtSecret }), async (req, res, next) => {
    try {
      const existing = await prisma.user.findUnique({ where: { id: req.user.sub } });
      if (!existing || existing.deletedAt) {
        clearAuthCookies(res, cfg);
        res.set('Cache-Control', 'no-store');
        return res.status(401).json({ error: 'UserRevokedOrDeleted' });
      }
      res.set('Cache-Control', 'no-store');
      return res.status(200).json({
        user: {
          sub: existing.id,
          email: existing.email,
          name: existing.name,
          emailVerifiedAt: existing.emailVerifiedAt,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};

export { ACCESS_COOKIE, REFRESH_COOKIE };
