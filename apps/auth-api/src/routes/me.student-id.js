/**
 * PATCH /api/me/student-id — 학번 단독 정정 (#571, 8자리 → 10자리 마이그레이션).
 *
 * 배경:
 *  - #568 로 zod 학번이 8자리 → 10자리로 정정됐지만, 그 전 verify-school 통과한
 *    사용자 중 8자리 studentId 가 DB 에 남아 있을 수 있음.
 *  - FE 가 hobby 진입 시 JWT payload.studentIdLegacy=true 사용자에게 blocking
 *    모달로 10자리 재입력 요구 → 본 라우트가 검증 + DB 업데이트.
 *
 * 정책:
 *  - auth + CSRF 보호 (csrf.js CSRF_PROTECTED_PATHS 에 추가).
 *  - 사전 조건: schoolVerifiedAt NOT NULL. 학교 인증 자체는 그대로, 학번만 정정 가능.
 *    미인증자가 호출하면 403 SchoolNotVerified — 학번만 갱신해도 학교 인증 흐름과 분리.
 *  - 입력: UpdateStudentIdInput (정확히 10자리 숫자, trim).
 *  - 성공 시 새 access/refresh 토큰 발급 (기존 refresh rotate) — 다음 가드 요청부터
 *    studentIdLegacy 누락 → blocking 해제. verify-school PR #569/#570 패턴과 동일.
 *
 * 파일 크기 가드 (CLAUDE.md): me.js 가 이미 316 줄이라 신규 라우트는 분리.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { UpdateStudentIdInput } from '@getit/schemas/auth';
import { zodErrorBody } from '@getit/schemas/errors';
import { Router } from 'express';

import { issueTokensAndCookies } from '../lib/issueTokens.js';
import { prisma } from '../lib/prisma.js';
import { clearAuthCookies, hashRefreshToken, readAuthEnv, REFRESH_COOKIE } from '../lib/tokens.js';

import { publicUser } from './userSerialize.js';

/**
 * 현재 요청의 refresh 쿠키에 해당하는 활성 refresh token 을 revoke.
 *
 * verify-school (#569) / nickname (#560) 와 동일 패턴 — 새 refresh 발급 직전 기존
 * 토큰 rotate 해서 DB 누적 방지. tx 가 주어지면 그 트랜잭션 컨텍스트에서 실행.
 *
 * @param {import('express').Request} req
 * @param {{ refreshToken: { updateMany: typeof prisma.refreshToken.updateMany } }} [tx]
 */
const revokeCurrentRefreshToken = async (req, tx) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) return;
  const client = tx ?? prisma;
  await client.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/**
 * /api/me/student-id 라우터 — 단일 책임 (학번 정정).
 *
 * @returns {import('express').Router}
 */
export const createMeStudentIdRouter = () => {
  const router = Router();
  const cfg = readAuthEnv();
  const auth = requireAuth({ secret: cfg.jwtSecret });

  router.patch('/me/student-id', auth, async (req, res, next) => {
    try {
      const parsed = UpdateStudentIdInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { studentId } = parsed.data;

      const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
      if (!user || user.deletedAt) {
        clearAuthCookies(res, cfg);
        return res.status(401).json({ error: 'UserNotFound' });
      }

      // 학교 인증 통과한 사용자만 학번 정정 가능. 미인증자는 정상 verify-school 흐름으로.
      if (!user.schoolVerifiedAt) {
        return res.status(403).json({ error: 'SchoolNotVerified' });
      }

      // 이미 10자리(또는 8자리가 아닌) 학번을 가진 사용자는 본 마이그레이션 API 대상 아님.
      // 정상 사용자가 학번을 임의로 변조하는 vector 차단. Gemini #578 1/3.
      if (!user.studentId || user.studentId.length !== 8) {
        return res.status(403).json({ error: 'NotLegacyStudentId' });
      }

      // DB 업데이트 + refresh rotate + 새 토큰 발급을 단일 트랜잭션으로 묶어 원자성 보장.
      // 학번만 10자리로 바뀌고 토큰 발급 실패 시 다음 가드에서 NotLegacyStudentId 로
      // 영구 잠금되는 사고 차단. Gemini #578 2/3 + 3/3.
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: user.id },
          data: { studentId },
        });
        // 새 토큰 발급 — JWT payload 에 studentIdLegacy 가 빠지면서 hobby 가드 해제.
        // 기존 refresh 도 rotate (CR #560 / #569 패턴).
        await revokeCurrentRefreshToken(req, tx);
        await issueTokensAndCookies(u, res, tx);
        return u;
      });

      return res.status(200).json({ user: publicUser(updated) });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
