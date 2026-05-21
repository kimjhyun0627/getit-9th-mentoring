/**
 * hobby-api 매칭 신청 라우터 — apply / cancel + approve / reject (#500/#502).
 *
 * 엔드포인트:
 *  - POST   /api/applications              — 신청 (JWT 필요). 정책별 분기 (applications.create.js).
 *  - DELETE /api/applications/:id          — 신청 취소 (JWT 필요, 본인만).
 *  - PATCH  /api/applications/:id/approve  — 방장 승인 (APPROVAL 정책).
 *  - PATCH  /api/applications/:id/reject   — 방장 거절 (APPROVAL 정책).
 *
 * 정책 분기 / 결정 로직은 applications.create.js / applications.decision.js 로 분리.
 * 이 파일은 라우터 와이어업 + 인증 + 입력 검증만 담당해 size cap 안에 유지.
 *
 * Race condition (FIRST_COME): 낙관적 동시성 + 조건부 updateMany. 자세한 내용은
 *   applications.create.js 의 handleFirstCome 주석 참조.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { ApplicationCreateInput, ApplicationIdParam } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

import { applyToPost, respondApply } from './applications.create.js';
import { approveApplication, rejectApplication, respondDecision } from './applications.decision.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const serializeApplication = (app) => ({
  id: app.id,
  postId: app.postId,
  userId: app.userId,
  status: app.status ?? 'APPROVED',
  createdAt: app.createdAt instanceof Date ? app.createdAt.toISOString() : app.createdAt,
});

/**
 * DELETE /api/applications/:id 핸들러 본체.
 * APPROVED 였던 신청만 capacity 롤백. PENDING/REJECTED 는 capacity 영향 없음 (정상 cancel 허용).
 *
 * @param {string} id
 * @param {string} userId
 */
const cancelApplication = async (id, userId) =>
  prisma.$transaction(async (tx) => {
    const app = await tx.application.findUnique({ where: { id } });
    if (!app) return { kind: 'NotFound' };
    if (app.userId !== userId) return { kind: 'Forbidden' };

    await tx.application.delete({ where: { id } });
    // 좌석은 APPROVED 상태일 때만 점유 중이므로, 그 경우에만 capacity 롤백.
    if (app.status === 'APPROVED' || app.status == null) {
      const dec = await tx.post.updateMany({
        where: { id: app.postId, currentCapacity: { gt: 0 } },
        data: { currentCapacity: { decrement: 1 } },
      });
      if (dec.count === 1) {
        await tx.post.updateMany({
          where: { id: app.postId, status: 'FULL' },
          data: { status: 'RECRUITING' },
        });
      }
    }
    return { kind: 'Ok' };
  });

/**
 * 매칭 라우터 생성.
 *
 * @param {{ jwtSecret: string, mutationLimiter?: import('express').RequestHandler }} opts
 * @returns {import('express').Router}
 */
export const createApplicationsRouter = ({ jwtSecret, mutationLimiter }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  const burstLimit = mutationLimiter ?? ((_req, _res, next) => next());

  // POST /api/applications — 신청 (정책별 분기).
  router.post('/applications', burstLimit, auth, async (req, res, next) => {
    try {
      const parsed = ApplicationCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const result = await applyToPost(prisma, parsed.data.postId, req.user.sub);
      return respondApply(res, result, serializeApplication);
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/applications/:id — 본인 신청 취소.
  router.delete('/applications/:id', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = ApplicationIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const result = await cancelApplication(parsedParam.data.id, req.user.sub);
      switch (result.kind) {
        case 'NotFound':
          return res.status(404).json({ error: 'ApplicationNotFound' });
        case 'Forbidden':
          return res.status(403).json({ error: 'Forbidden' });
        case 'Ok':
          return res.status(204).send();
        default:
          return res.status(500).json({ error: 'InternalServerError' });
      }
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/applications/:id/approve — 방장 승인 (APPROVAL 정책).
  router.patch('/applications/:id/approve', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = ApplicationIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const result = await approveApplication(prisma, parsedParam.data.id, req.user.sub);
      return respondDecision(res, result);
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/applications/:id/reject — 방장 거절 (APPROVAL 정책).
  router.patch('/applications/:id/reject', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = ApplicationIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const result = await rejectApplication(prisma, parsedParam.data.id, req.user.sub);
      return respondDecision(res, result);
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
