/**
 * hobby-api 매칭 신청 라우터 — apply / cancel + race-safe transaction.
 *
 * 엔드포인트:
 *  - POST   /api/applications      — 신청 (JWT 필요)
 *  - DELETE /api/applications/:id  — 신청 취소 (JWT 필요, 본인만)
 *
 * Race condition 정책:
 *  - 남은 1자리에 N명 동시 신청 → 정확히 1명만 성공.
 *  - 해결 전략: 낙관적 동시성. Prisma `$transaction` 안에서
 *    `post.updateMany({ where: { id, status: 'RECRUITING', currentCapacity: { lt: capacity } }, data: { currentCapacity: { increment: 1 } } })`
 *    로 조건부 증가. count==0 → 다른 트랜잭션이 먼저 좌석을 가져갔다는 뜻이므로
 *    `PostFull` (422) 로 거부. MySQL InnoDB row-lock 으로 atomic.
 *  - 좌석 확보 성공 시 capacity 도달했으면 같은 트랜잭션 안에서 status→FULL 전이.
 *  - Application 생성은 같은 트랜잭션 안. unique 제약 충돌(P2002) → 409 AlreadyApplied.
 *
 * 취소 정책:
 *  - applicant 본인만 취소 가능. 타인 → 403.
 *  - 같은 트랜잭션 안에서: Application 삭제 + Post.currentCapacity 1 감소 +
 *    status 가 FULL 이었다면 RECRUITING 으로 롤백.
 *  - currentCapacity 가 0 인데 감소 시도되는 inconsistent state 는 발생 불가
 *    (생성 시 increment 와 1:1). 방어적 가드만 추가.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { ApplicationCreateInput, ApplicationIdParam } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const serializeApplication = (app) => ({
  id: app.id,
  postId: app.postId,
  userId: app.userId,
  createdAt: app.createdAt instanceof Date ? app.createdAt.toISOString() : app.createdAt,
});

/**
 * 매칭 라우터 생성.
 *
 * @param {{ jwtSecret: string }} opts
 * @returns {import('express').Router}
 */
export const createApplicationsRouter = ({ jwtSecret }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });

  // POST /api/applications — 신청
  router.post('/applications', auth, async (req, res, next) => {
    try {
      const parsed = ApplicationCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { postId } = parsed.data;
      const userId = req.user.sub;

      // 트랜잭션: 좌석 확보 + Application 생성.
      // 조건부 updateMany 로 race condition 차단 (atomic UPDATE...WHERE row-lock).
      const result = await prisma.$transaction(async (tx) => {
        const post = await tx.post.findUnique({
          where: { id: postId },
          select: { id: true, ownerId: true, capacity: true, currentCapacity: true, status: true },
        });
        if (!post) return { kind: 'NotFound' };
        if (post.ownerId === userId) return { kind: 'OwnerCannotApply' };
        if (post.status !== 'RECRUITING') return { kind: 'PostNotOpen', status: post.status };

        // 중복 신청 사전 체크 — capacity 를 헛 increment 하지 않기 위함.
        // 진짜 race (동시 신청자 둘) 는 아래 unique 제약 + 보상 decrement 가 잡음.
        const existing = await tx.application.findUnique({
          where: { postId_userId: { postId, userId } },
        });
        if (existing) return { kind: 'AlreadyApplied' };

        // 좌석 확보: 조건부 increment. count==0 → 다른 트랜잭션이 먼저 가져갔거나 마감.
        const seat = await tx.post.updateMany({
          where: {
            id: postId,
            status: 'RECRUITING',
            currentCapacity: { lt: post.capacity },
          },
          data: { currentCapacity: { increment: 1 } },
        });
        if (seat.count === 0) return { kind: 'PostFull' };

        // Application 생성. unique 제약 (postId, userId) 충돌 → 409 AlreadyApplied.
        // 사전 체크와 unique create 사이 race 면 P2002 가 발생할 수 있으므로
        // 보상 decrement 로 currentCapacity 를 원복 (FakePrisma 는 진짜 롤백이
        // 없고, 실 Prisma 도 콜백 throw 만 자동 롤백 → 명시적 보상이 안전).
        let application;
        try {
          application = await tx.application.create({
            data: { postId, userId },
          });
        } catch (err) {
          if (err?.code === 'P2002') {
            await tx.post.updateMany({
              where: { id: postId, currentCapacity: { gt: 0 } },
              data: { currentCapacity: { decrement: 1 } },
            });
            return { kind: 'AlreadyApplied' };
          }
          throw err;
        }

        // 정원 도달했으면 FULL 전이.
        const after = post.currentCapacity + 1;
        if (after >= post.capacity) {
          await tx.post.update({
            where: { id: postId },
            data: { status: 'FULL' },
          });
        }

        return { kind: 'Ok', application };
      });

      switch (result.kind) {
        case 'NotFound':
          return res.status(404).json({ error: 'PostNotFound' });
        case 'OwnerCannotApply':
          return res.status(409).json({ error: 'OwnerCannotApply' });
        case 'PostNotOpen':
          return res.status(422).json({ error: 'PostNotOpen', status: result.status });
        case 'PostFull':
          return res.status(422).json({ error: 'PostFull' });
        case 'AlreadyApplied':
          return res.status(409).json({ error: 'AlreadyApplied' });
        case 'Ok':
          return res.status(201).json({ application: serializeApplication(result.application) });
        default:
          return res.status(500).json({ error: 'InternalServerError' });
      }
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/applications/:id — 본인 신청 취소
  router.delete('/applications/:id', auth, async (req, res, next) => {
    try {
      const parsedParam = ApplicationIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const id = parsedParam.data.id;
      const userId = req.user.sub;

      const result = await prisma.$transaction(async (tx) => {
        const app = await tx.application.findUnique({ where: { id } });
        if (!app) return { kind: 'NotFound' };
        if (app.userId !== userId) return { kind: 'Forbidden' };

        // 삭제 + capacity 롤백. 조건부 updateMany 로 0 미만 가드.
        await tx.application.delete({ where: { id } });
        const dec = await tx.post.updateMany({
          where: { id: app.postId, currentCapacity: { gt: 0 } },
          data: { currentCapacity: { decrement: 1 } },
        });
        if (dec.count === 1) {
          // FULL 이었으면 RECRUITING 으로 롤백 (CLOSED 는 그대로 둠).
          await tx.post.updateMany({
            where: { id: app.postId, status: 'FULL' },
            data: { status: 'RECRUITING' },
          });
        }
        return { kind: 'Ok' };
      });

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

  return router;
};
