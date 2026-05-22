/**
 * 학교 메일 인증 라우터 (Issue #538, PRD `.claude/projects/school-auth.md`).
 *
 * 흐름:
 *   1) POST /api/me/school-link         — 학교 메일 입력 → 1회용 토큰 메일 발송
 *   2) POST /api/auth/verify-school     — 토큰 + 학번 8자리 → 인증 확정
 *   3) POST /api/me/school-link/resend  — 같은 메일에 새 토큰 재발송
 *
 * 정책:
 *  - `@knu.ac.kr` 도메인만 허용 (Zod). 다른 도메인 400 `InvalidSchoolEmail`.
 *  - 같은 schoolEmail 이 **다른 user 에게 이미 인증**돼 있으면 409 `SchoolEmailTaken`.
 *  - 토큰: cuid 32+ 자 + SHA-256 hash 저장. TTL 30분. 평문은 메일에만.
 *  - 발급 시 해당 유저의 기존 미사용 토큰 (`usedAt` null) 은 모두 즉시 `usedAt=now` 로 무효화.
 *  - 응답: enumeration 방어 통합 응답 `{ ok: true, sent: boolean, email: <masked> }`.
 *  - Rate limit: link 분당 3건/유저, resend 분당 1건/유저.
 *  - PII: studentId / schoolEmail 로그에 절대 X.
 *
 * 파일 크기 가드: 150줄 권장 / 300줄 max — link/verify/resend 만 담는다.
 */
import crypto from 'node:crypto';

import { requireAuth } from '@getit/auth-utils/server';
import { SchoolLinkInput, VerifySchoolInput } from '@getit/schemas/auth';
import { zodErrorBody } from '@getit/schemas/errors';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { sendSchoolVerifyEmail } from '../lib/mailer.js';
import { prisma } from '../lib/prisma.js';
import { generateRefreshToken, readAuthEnv } from '../lib/tokens.js';

import { publicUser } from './userSerialize.js';

const SCHOOL_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * 학교 메일 마스킹 — 로컬파트 첫 2글자 + `***` + `@knu.ac.kr`.
 *
 * @param {string} email - 마스킹할 학교 메일.
 * @returns {string} 마스킹된 표현.
 */
const maskEmail = (email) => {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
};

/**
 * SHA-256 hex hash — refresh/verify 토큰과 동일 패턴.
 *
 * @param {string} raw - 평문 토큰.
 * @returns {string} hex 인코딩된 hash.
 */
const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * 유저 ID 기반 keyGenerator. JWT 가 통과한 후라 req.user.sub 가 항상 존재.
 *
 * @param {import('express').Request} req
 */
const userKey = (req) => req.user?.sub ?? req.ip;

/**
 * 학교 인증 라우터 생성.
 *
 * @param {{ linkMax?: number, resendMax?: number, windowMs?: number }} [opts]
 *   - linkMax: /school-link 분당 허용 횟수 (운영 3, 테스트 1000).
 *   - resendMax: /school-link/resend 분당 허용 횟수 (운영 1, 테스트 1000 / 전용 테스트만 작게).
 * @returns {import('express').Router}
 */
export const createSchoolVerifyRouter = (opts = {}) => {
  const { linkMax = 3, resendMax = 1, windowMs = 60 * 1000 } = opts;
  const router = Router();
  const cfg = readAuthEnv();
  const auth = requireAuth({ secret: cfg.jwtSecret });

  // PRD §보안 — link 분당 3건 / 유저 (운영). 테스트는 충분히 크게.
  const linkLimiter = rateLimit({
    windowMs,
    max: linkMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userKey,
    message: { error: 'RateLimitExceeded' },
  });
  // resend 는 더 빡빡. 분당 1건 / 유저 (운영).
  const resendLimiter = rateLimit({
    windowMs,
    max: resendMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userKey,
    message: { error: 'RateLimitExceeded' },
  });

  // 공용 link 발급 핸들러 (link / resend 가 공유).
  const issueLink = async (req, res) => {
    const parsed = SchoolLinkInput.safeParse(req.body);
    if (!parsed.success) {
      // PRD: `@knu.ac.kr` 아닌 도메인 → InvalidSchoolEmail (400). 그 외 Zod 일반.
      const wrongDomain = parsed.error?.issues?.some((i) => /knu\.ac\.kr/.test(i.message ?? ''));
      if (wrongDomain) {
        return res.status(400).json({ error: 'InvalidSchoolEmail' });
      }
      return res.status(400).json(zodErrorBody(parsed.error));
    }
    const { email } = parsed.data;

    // 다른 user 가 이미 인증한 학교 메일이면 409.
    const owner = await prisma.user.findUnique({ where: { schoolEmail: email } });
    if (owner && owner.id !== req.user.sub && owner.schoolVerifiedAt) {
      return res.status(409).json({ error: 'SchoolEmailTaken' });
    }

    // 기존 미사용 토큰 모두 무효화 (UPDATE usedAt=now).
    await prisma.schoolVerifyToken.updateMany({
      where: { userId: req.user.sub, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = generateRefreshToken();
    const tokenHash = sha256(raw);
    const expiresAt = new Date(Date.now() + SCHOOL_TOKEN_TTL_MS);
    await prisma.schoolVerifyToken.create({
      data: { userId: req.user.sub, email, tokenHash, expiresAt },
    });

    const base = process.env.AUTH_WEB_URL ?? 'https://auth.get-it.cloud';
    const verifyUrl = `${base}/verify-school?token=${raw}`;
    // fire-and-forget — 발송 실패가 가입/리셋과 동일하게 응답에 영향 X.
    sendSchoolVerifyEmail({ to: email, verifyUrl }).catch(() => null);

    return res.status(200).json({ ok: true, sent: true, email: maskEmail(email) });
  };

  // POST /api/me/school-link
  router.post('/me/school-link', auth, linkLimiter, async (req, res, next) => {
    try {
      return await issueLink(req, res);
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/me/school-link/resend
  router.post('/me/school-link/resend', auth, resendLimiter, async (req, res, next) => {
    try {
      return await issueLink(req, res);
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/auth/verify-school — 토큰 + 학번 → 인증 확정.
  // 인증 미들웨어는 적용하지 않는다 (PRD: 클릭 후 토큰만으로 동작 — 단, 토큰 안에 userId 포함).
  router.post('/auth/verify-school', async (req, res, next) => {
    try {
      const parsed = VerifySchoolInput.safeParse(req.body);
      if (!parsed.success) {
        // studentId 형식 오류는 ValidationError, 토큰 형식 오류는 InvalidToken 으로 통일.
        const badToken = parsed.error?.issues?.some((i) => i.path?.[0] === 'token');
        if (badToken) return res.status(400).json({ error: 'InvalidToken' });
        return res.status(400).json(zodErrorBody(parsed.error));
      }
      const { token, studentId } = parsed.data;

      const tokenHash = sha256(token);
      const row = await prisma.schoolVerifyToken.findUnique({ where: { tokenHash } });
      const now = new Date();
      if (!row || row.usedAt || row.expiresAt <= now) {
        return res.status(400).json({ error: 'InvalidToken' });
      }

      // 다른 user 가 이미 인증한 학교 메일이면 409. (race-safety: 토큰 발급 후 인증 완료까지의 갭)
      const owner = await prisma.user.findUnique({ where: { schoolEmail: row.email } });
      if (owner && owner.id !== row.userId && owner.schoolVerifiedAt) {
        return res.status(409).json({ error: 'SchoolEmailTaken' });
      }

      // 트랜잭션 — 토큰 1회 소비 보장 + 탈퇴 유저 차단 + User 업데이트.
      // 1) 토큰 consume 를 conditional updateMany 로 먼저 시도 → race-safe (CR #546).
      //    동일 토큰 동시 요청이 둘 다 성공하는 케이스를 막는다.
      // 2) 유저가 탈퇴 (deletedAt) 상태면 InvalidToken 으로 폐기.
      const updated = await prisma.$transaction(async (tx) => {
        const consumed = await tx.schoolVerifyToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now, studentId },
        });
        if (consumed.count !== 1) {
          const e = new Error('InvalidToken');
          e.status = 400;
          e.code = 'InvalidToken';
          throw e;
        }
        // 토큰 소비 직후 유저 상태 재확인 — 탈퇴/삭제 케이스 차단.
        const target = await tx.user.findUnique({ where: { id: row.userId } });
        if (!target || target.deletedAt) {
          const e = new Error('InvalidToken');
          e.status = 400;
          e.code = 'InvalidToken';
          throw e;
        }
        return tx.user.update({
          where: { id: row.userId },
          data: { studentId, schoolEmail: row.email, schoolVerifiedAt: now },
        });
      });

      return res.status(200).json({ ok: true, user: publicUser(updated) });
    } catch (err) {
      // InvalidToken — 트랜잭션 내부 race / 탈퇴 유저로 throw 된 케이스.
      if (err?.code === 'InvalidToken') {
        return res.status(400).json({ error: 'InvalidToken' });
      }
      // P2002 — schoolEmail unique 충돌 (race 발생). 409 매핑.
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'SchoolEmailTaken' });
      }
      return next(err);
    }
  });

  return router;
};
