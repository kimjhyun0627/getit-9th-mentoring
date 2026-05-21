/**
 * /api/me/* — 프로필 수정 / 회원 탈퇴 / 활성 세션 (Issue #235, #231, #321).
 *
 * 모든 라우트는 JWT auth 필수 + DB 재조회로 deletedAt 검사.
 *
 * 정책:
 *  - PATCH /api/me/profile: name/email/password 변경. currentPassword 재인증 필수.
 *      - email 변경 시 emailVerifiedAt 초기화 + 새 verifyToken 발급 + 메일 발송.
 *      - password 변경 시 모든 refresh token revoke + 새 토큰 set (현재 세션 유지).
 *  - POST /api/me/delete: 회원 탈퇴 (soft-delete).
 *      - currentPassword 재인증.
 *      - email 을 `deleted+<id>@deleted.local` 로 치환 (unique 충돌 방지 + 재가입 가능).
 *      - 모든 refresh token revoke + 쿠키 clear.
 *  - GET  /api/me/sessions: 활성 refresh token 목록.
 *  - POST /api/me/sessions/revoke-others: 현재 토큰 외 전부 revoke (Issue #321 일부).
 */
import crypto from 'node:crypto';

import { requireAuth } from '@getit/auth-utils/server';
import { DeleteAccountInput, UpdateProfileInput } from '@getit/schemas/auth';
import { zodErrorBody } from '@getit/schemas/errors';
import bcrypt from 'bcrypt';
import { Router } from 'express';

import { sendVerifyEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import {
  clearAuthCookies,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  readAuthEnv,
  REFRESH_COOKIE,
  setAuthCookies,
} from '../lib/tokens.js';

const BCRYPT_COST = Number.parseInt(process.env.BCRYPT_COST ?? '12', 10);
const PRISMA_UNIQUE_VIOLATION = 'P2002';

const publicUser = (u) => ({
  sub: u.id,
  email: u.email,
  name: u.name,
  emailVerifiedAt: u.emailVerifiedAt,
});

/**
 * 인증된 user 의 raw DB row 를 가져온다 (deletedAt 검사 포함).
 *
 * @param {string} userId
 */
const loadActiveUser = async (userId) => {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.deletedAt) return null;
  return u;
};

/**
 * /api/me/* 라우터.
 *
 * @returns {import('express').Router}
 */
export const createMeRouter = () => {
  const router = Router();
  const cfg = readAuthEnv();
  const auth = requireAuth({ secret: cfg.jwtSecret });

  // PATCH /api/me/profile — 이름/이메일/비밀번호 변경 (#235)
  router.patch('/me/profile', auth, async (req, res, next) => {
    try {
      const parsed = UpdateProfileInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { name, email, currentPassword, newPassword } = parsed.data;

      const user = await loadActiveUser(req.user.sub);
      if (!user) {
        clearAuthCookies(res, cfg);
        return res.status(401).json({ error: 'UserNotFound' });
      }

      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'InvalidCurrentPassword' });

      const emailChanged = email !== user.email;
      const data = { name };
      if (emailChanged) {
        data.email = email;
        data.emailVerifiedAt = null;
      }
      if (newPassword) {
        data.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
      }

      let updated;
      try {
        updated = await prisma.user.update({ where: { id: user.id }, data });
      } catch (err) {
        if (err?.code === PRISMA_UNIQUE_VIOLATION) {
          return res.status(409).json({ error: 'EmailAlreadyInUse' });
        }
        throw err;
      }

      // 비밀번호 변경 시 모든 기존 refresh token 강제 revoke + 새 토큰 set (현재 세션 유지).
      if (newPassword) {
        await prisma.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const accessToken = generateAccessToken(
          { sub: updated.id, email: updated.email, name: updated.name },
          cfg.jwtSecret,
          cfg.accessTtl,
        );
        const refreshToken = generateRefreshToken();
        const expiresAt = new Date(Date.now() + cfg.refreshTtlDays * 24 * 60 * 60 * 1000);
        await prisma.refreshToken.create({
          data: { userId: updated.id, tokenHash: hashRefreshToken(refreshToken), expiresAt },
        });
        setAuthCookies(res, { accessToken, refreshToken }, cfg);
      }

      // 이메일 변경 시 새 verify token + 발송 (fire-and-forget).
      if (emailChanged) {
        try {
          const t = generateRefreshToken();
          const h = crypto.createHash('sha256').update(t).digest('hex');
          await prisma.emailVerifyToken.create({
            data: {
              userId: updated.id,
              tokenHash: h,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
          const base = process.env.AUTH_WEB_URL ?? 'https://auth.get-it.cloud';
          sendVerifyEmail({
            to: updated.email,
            verifyUrl: `${base}/verify-email?token=${t}`,
          }).catch(() => null);
        } catch (err) {
          req.log?.warn?.({ err: String(err) }, 'verify email after email-change failed');
        }
      }

      return res.status(200).json({ user: publicUser(updated) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/me/delete — 회원 탈퇴 (#231, soft-delete)
  router.post('/me/delete', auth, async (req, res, next) => {
    try {
      const parsed = DeleteAccountInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { currentPassword } = parsed.data;

      const user = await loadActiveUser(req.user.sub);
      if (!user) {
        clearAuthCookies(res, cfg);
        return res.status(401).json({ error: 'UserNotFound' });
      }

      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'InvalidCurrentPassword' });

      const now = new Date();
      // email 을 치환해 unique 충돌 방지. 평문 email 은 흘리지 않는다.
      const tombstoneEmail = `deleted+${user.id}@deleted.local`;
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { deletedAt: now, email: tombstoneEmail },
        });
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
      });
      clearAuthCookies(res, cfg);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/me/sessions — 활성 refresh 토큰 목록
  router.get('/me/sessions', auth, async (req, res, next) => {
    try {
      const user = await loadActiveUser(req.user.sub);
      if (!user) return res.status(401).json({ error: 'UserNotFound' });
      const now = new Date();
      // 비밀번호 해시 등 민감 필드는 노출 X. id/createdAt/expiresAt 만.
      const all = [];
      // findMany 가 fake-prisma 에 없어 updateMany 패턴 활용 — 직접 in-memory 순회는 곤란.
      // 대신 useless update 로 row 들을 cycle 하지 않고, 별도 fakePrisma.refreshToken.findMany 가 없어도
      // userId 기반 in-memory 조회를 위해 Prisma 의 findMany 를 사용한다.
      // (운영 Prisma 는 findMany 지원. fake setup 에 추가로 보강.)
      const list = await prisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
      });
      for (const r of list) {
        all.push({ id: r.id, createdAt: r.createdAt, expiresAt: r.expiresAt });
      }
      return res.status(200).json({ sessions: all });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/me/sessions/revoke-others — 현재 토큰 외 전부 revoke (#321 일부)
  router.post('/me/sessions/revoke-others', auth, async (req, res, next) => {
    try {
      const user = await loadActiveUser(req.user.sub);
      if (!user) return res.status(401).json({ error: 'UserNotFound' });
      const currentRaw = req.cookies?.[REFRESH_COOKIE];
      const currentHash = currentRaw ? hashRefreshToken(currentRaw) : null;
      // 현재 refresh 토큰을 제외한 모든 활성 토큰 revoke.
      // (현재 토큰 hash 가 null 이면 모두 revoke — fallback)
      const list = await prisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      const targetIds = list
        .filter((r) => !currentHash || r.tokenHash !== currentHash)
        .map((r) => r.id);
      let revoked = 0;
      for (const id of targetIds) {
        await prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
        revoked += 1;
      }
      return res.status(200).json({ revoked });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
