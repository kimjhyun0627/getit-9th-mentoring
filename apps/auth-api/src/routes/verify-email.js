/**
 * 이메일 인증 라우터 (Issue #226).
 *
 * 흐름:
 *   1. signup 시 auth.js 가 EmailVerifyToken 1건 발급 + 메일 stub 발송 (24h TTL).
 *   2. POST /api/verify-email { token } — 토큰 소비 + User.emailVerifiedAt 마킹.
 *   3. POST /api/verify-email/resend — 로그인한 사용자가 재발송 요청. rate-limit 적용.
 *
 * 보안:
 *  - 토큰 평문은 절대 저장 X. SHA-256 해시만.
 *  - 검증/재발송 모두 응답시간 일정화는 비용 대비 효과 낮음 → 미적용 (가입은 timing leak 방어).
 */
import crypto from 'node:crypto';

import { requireAuth } from '@getit/auth-utils/server';
import { VerifyEmailInput } from '@getit/schemas/auth';
import { zodErrorBody } from '@getit/schemas/errors';
import { Router } from 'express';

import { sendVerifyEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import { generateRefreshToken, readAuthEnv } from '../lib/tokens.js';

const VERIFY_TTL_HOURS = 24;

const hashVerifyToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

/**
 * 이메일 인증 라우터.
 *
 * @param {{ verifyLimiter: import('express').RequestHandler }} opts
 */
export const createVerifyEmailRouter = ({ verifyLimiter }) => {
  const router = Router();
  const cfg = readAuthEnv();

  // POST /api/verify-email { token } — 인증 토큰 소비
  router.post('/verify-email', verifyLimiter, async (req, res, next) => {
    try {
      const parsed = VerifyEmailInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const tokenHash = hashVerifyToken(parsed.data.token);
      const now = new Date();

      const ok = await prisma.$transaction(async (tx) => {
        const { count } = await tx.emailVerifyToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (count !== 1) return false;
        const stored = await tx.emailVerifyToken.findUnique({ where: { tokenHash } });
        if (!stored) return false;
        await tx.user.update({
          where: { id: stored.userId },
          data: { emailVerifiedAt: now },
        });
        return true;
      });

      if (!ok) return res.status(400).json({ error: 'InvalidOrExpiredToken' });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/verify-email/resend — 로그인 사용자가 재발송 요청
  router.post(
    '/verify-email/resend',
    verifyLimiter,
    requireAuth({ secret: cfg.jwtSecret }),
    async (req, res, next) => {
      try {
        const userId = req.user.sub;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.deletedAt) return res.status(401).json({ error: 'UserNotFound' });
        if (user.emailVerifiedAt) {
          return res.status(200).json({ ok: true, alreadyVerified: true });
        }

        // 이전 미사용 토큰 무효화 후 새 토큰 발급.
        await prisma.emailVerifyToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: new Date() },
        });
        const token = generateRefreshToken();
        const tokenHash = hashVerifyToken(token);
        const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 60 * 60 * 1000);
        await prisma.emailVerifyToken.create({ data: { userId, tokenHash, expiresAt } });

        const base = process.env.AUTH_WEB_URL ?? 'https://auth.get-it.cloud';
        const verifyUrl = `${base}/verify-email?token=${token}`;
        sendVerifyEmail({ to: user.email, verifyUrl }).catch(() => null);

        return res.status(200).json({ ok: true });
      } catch (err) {
        return next(err);
      }
    },
  );

  return router;
};
