/**
 * 비밀번호 재설정 라우터 (Issue #221).
 *
 * 흐름:
 *   1. POST /api/password/forgot { email } → 1회용 토큰 발급 (15분 TTL).
 *      - enumeration 차단: 미등록 이메일이어도 항상 200.
 *      - dev 모드 (`RESET_TOKEN_DEV_RETURN=true`) 면 응답 본문에 token 노출.
 *      - 운영에선 console.log 만 (이메일 발송은 후속 issue).
 *   2. POST /api/password/reset { token, password, passwordConfirm }
 *      - 토큰 검증 (해시 일치 + 만료 X + 미사용).
 *      - 비밀번호 교체 + 토큰 used 마킹 + 사용자의 모든 refresh 토큰 revoke.
 *
 * 보안:
 *   - 토큰은 평문으로 절대 저장 X. SHA-256 해시만 DB.
 *   - 토큰 발급/소비 모두 동일 응답시간/메시지로 enumeration 방지.
 */
import crypto from 'node:crypto';

import { ForgotPasswordInput, ResetPasswordInput } from '@getit/schemas/auth';
import bcrypt from 'bcrypt';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

const BCRYPT_COST = Number.parseInt(process.env.BCRYPT_COST ?? '12', 10);
const RESET_TOKEN_TTL_MIN = Number.parseInt(process.env.RESET_TOKEN_TTL_MIN ?? '15', 10);

/**
 * 환경변수 기반 dev 토큰 노출 여부.
 *
 * dev/staging 에선 응답 본문에 token 을 노출해 이메일 인프라 없이도 흐름 검증 가능.
 * 운영에선 반드시 false → 토큰은 이메일로만 전달.
 *
 * 운영 사고 방지 (CodeRabbit): NODE_ENV=production 일 땐 RESET_TOKEN_DEV_RETURN
 * 환경변수가 실수로 켜져 있어도 무시한다. 명시적 NODE_ENV gate 가 우선.
 *
 * @returns {boolean}
 */
const shouldReturnTokenInResponse = () => {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.RESET_TOKEN_DEV_RETURN === 'true' || process.env.NODE_ENV === 'test';
};

/**
 * Zod 에러 → 400 본문.
 *
 * @param {import('zod').ZodError} err
 * @returns {{ error: string, issues: Array<{ path: string, message: string }> }}
 */
const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

/**
 * 1회용 reset token (64 hex chars). DB엔 SHA-256 해시만 저장.
 *
 * @returns {string}
 */
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Reset token 의 SHA-256 해시 (DB 조회용).
 *
 * @param {string} token
 * @returns {string}
 */
const hashResetToken = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');

/**
 * 비밀번호 재설정 라우터 생성.
 *
 * @param {{ resetLimiter: import('express').RequestHandler }} opts
 * @returns {import('express').Router}
 */
export const createPasswordResetRouter = ({ resetLimiter }) => {
  const router = Router();

  // POST /api/password/forgot — 토큰 발급
  router.post('/password/forgot', resetLimiter, async (req, res, next) => {
    try {
      const parsed = ForgotPasswordInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const { email } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      const token = generateResetToken();
      const tokenHash = hashResetToken(token);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

      // 응답시간 enumeration 방어 (Gemini #3):
      // 미존재 사용자의 경우에도 동일한 DB 작업 (updateMany no-op) 을 수행해
      // 존재/미존재 분기의 시간 차이를 최소화한다. token 생성도 양쪽 모두 실행.
      // 실제 row 생성은 user 가 있을 때만 (가짜 row 를 만들면 DB 가 쓰레기로 차서 거부).
      if (!user) {
        // 무 효과 updateMany — userId 가 빈 문자열이라 항상 0건 matching.
        // 실제 DB 라운드트립은 발생 → 시간 일정화.
        await prisma.passwordResetToken
          .updateMany({
            where: { userId: '__nonexistent__', usedAt: null },
            data: { usedAt: new Date() },
          })
          .catch(() => null);
        return res.status(200).json({ ok: true });
      }

      // 이전 미사용 토큰은 무효화 (한 사용자당 활성 토큰 1개만 의미 있게).
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      // 운영: 토큰을 응답에 노출하지 않음. 이메일 발송은 별도 issue.
      // 개발 편의용으로 환경변수로 켜진 경우에만 응답 본문에 포함.
      // 디버깅 로그는 NODE_ENV=test 에선 silent (테스트 출력 깨끗하게).
      if (process.env.NODE_ENV !== 'test') {
        req.log?.info?.(
          { userId: user.id, tokenLength: token.length, expiresAt: expiresAt.toISOString() },
          '[password-reset] token issued',
        );
      }
      if (shouldReturnTokenInResponse()) {
        return res.status(200).json({ ok: true, token, expiresAt: expiresAt.toISOString() });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/password/reset — 토큰 소비 + 비밀번호 교체 (원자적 트랜잭션)
  router.post('/password/reset', resetLimiter, async (req, res, next) => {
    try {
      const parsed = ResetPasswordInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const { token, password } = parsed.data;
      const tokenHash = hashResetToken(token);

      // bcrypt.hash 는 비용 크고 외부 상태에 의존 X → 트랜잭션 밖에서 먼저 수행.
      // 트랜잭션 안에서 해싱하면 DB lock 보유 시간이 비정상적으로 길어진다.
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      const now = new Date();

      // 토큰 소비 + 비밀번호 교체 + refresh 토큰 revoke 를 하나의 트랜잭션으로 묶어
      // 어느 단계에서 실패해도 전체가 롤백되도록 한다 (Gemini #1).
      const success = await prisma.$transaction(async (tx) => {
        // 1회용 토큰 원자적 마킹: usedAt IS NULL + expiresAt > now 일 때만 갱신.
        const { count } = await tx.passwordResetToken.updateMany({
          where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (count !== 1) return false;

        const stored = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
        if (!stored) return false;

        await tx.user.update({
          where: { id: stored.userId },
          data: { passwordHash },
        });

        // 보안: 비밀번호 변경 시 기존 모든 refresh 토큰 강제 revoke.
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: now },
        });

        return true;
      });

      if (!success) {
        return res.status(400).json({ error: 'InvalidOrExpiredToken' });
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
