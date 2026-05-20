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
      //
      // 흐름 제어 노트: kind!=='Ok' 인 비즈니스 거부는 sentinel error (BizReject) 로
      // throw → 트랜잭션 자동 롤백 → 바깥에서 catch 해서 HTTP 분기.
      // 이렇게 하면 P2002 보상 decrement 같은 수동 롤백을 안 해도 됨 (Gemini #2 적용).
      class BizReject extends Error {
        constructor(kind, extra = {}) {
          super(kind);
          this.kind = kind;
          this.extra = extra;
        }
      }

      let result;
      try {
        result = await prisma.$transaction(async (tx) => {
          const post = await tx.post.findUnique({
            where: { id: postId },
            select: {
              id: true,
              ownerId: true,
              capacity: true,
              status: true,
              meetAt: true,
            },
          });
          if (!post) throw new BizReject('NotFound');
          if (post.ownerId === userId) throw new BizReject('OwnerCannotApply');
          if (post.status !== 'RECRUITING') {
            throw new BizReject('PostNotOpen', { status: post.status });
          }
          // #211: 과거 시각 모임은 신청 차단. list 에서 이미 가렸지만
          // 다이렉트 URL/캐시로 들어와도 가드.
          if (post.meetAt && new Date(post.meetAt) <= new Date()) {
            throw new BizReject('PostExpired');
          }

          // 중복 신청 사전 체크 — 좋은 UX (409 즉시 응답) + 헛 increment 회피.
          // 진짜 race 는 application.create 의 unique 제약이 backstop.
          const existing = await tx.application.findUnique({
            where: { postId_userId: { postId, userId } },
          });
          if (existing) throw new BizReject('AlreadyApplied');

          // 좌석 확보: 조건부 increment. count==0 → 마감 또는 동시 신청 패배.
          const seat = await tx.post.updateMany({
            where: {
              id: postId,
              status: 'RECRUITING',
              currentCapacity: { lt: post.capacity },
            },
            data: { currentCapacity: { increment: 1 } },
          });
          if (seat.count === 0) throw new BizReject('PostFull');

          // Application 생성. P2002 (중복 신청 race) → throw 로 자동 롤백
          // → currentCapacity 도 같이 원복 (Gemini #2 — 수동 보상 제거).
          let application;
          try {
            application = await tx.application.create({ data: { postId, userId } });
          } catch (err) {
            if (err?.code === 'P2002') throw new BizReject('AlreadyApplied');
            throw err;
          }

          // 정원 도달 확인. 스냅샷 + 1 이 아닌 fresh refetch 로 검사 (Gemini #1).
          // 진짜 currentCapacity 가 capacity 에 도달했을 때만 FULL 로 전이.
          const fresh = await tx.post.findUnique({
            where: { id: postId },
            select: { currentCapacity: true, capacity: true, status: true },
          });
          if (fresh && fresh.status === 'RECRUITING' && fresh.currentCapacity >= fresh.capacity) {
            await tx.post.update({
              where: { id: postId },
              data: { status: 'FULL' },
            });

            // FULL 전이 훅: 방장 + 모든 신청자에게 MATCH_FULL 알림 생성 (#36).
            // - 같은 트랜잭션 안 → FULL 전이가 롤백되면 알림도 같이 롤백 (정합성).
            // - 방장 ownerId 는 post 의 정보. 신청자는 application 조회.
            // - 두 쿼리는 서로 독립이므로 Promise.all 로 병렬화 — 트랜잭션 점유 단축
            //   (Gemini 제안 적용).
            const [ownerRow, apps] = await Promise.all([
              tx.post.findUnique({
                where: { id: postId },
                select: { ownerId: true, title: true },
              }),
              tx.application.findMany({
                where: { postId },
                select: { userId: true },
              }),
            ]);
            const recipientSet = new Set(apps.map((a) => a.userId));
            if (ownerRow?.ownerId) recipientSet.add(ownerRow.ownerId);
            const title = ownerRow?.title ?? '';
            const message = title
              ? `「${title}」 모집이 마감됐어요. 오픈채팅으로 들어가 보세요.`
              : '모집이 마감됐어요. 오픈채팅으로 들어가 보세요.';
            await tx.notification.createMany({
              data: [...recipientSet].map((userId) => ({
                userId,
                postId,
                kind: 'MATCH_FULL',
                message,
              })),
            });
          }

          return { kind: 'Ok', application };
        });
      } catch (err) {
        if (err instanceof BizReject) {
          result = { kind: err.kind, ...err.extra };
        } else {
          throw err;
        }
      }

      switch (result.kind) {
        case 'NotFound':
          return res.status(404).json({ error: 'PostNotFound' });
        case 'OwnerCannotApply':
          return res.status(409).json({ error: 'OwnerCannotApply' });
        case 'PostNotOpen':
          return res.status(422).json({ error: 'PostNotOpen', status: result.status });
        case 'PostFull':
          return res.status(422).json({ error: 'PostFull' });
        case 'PostExpired':
          return res.status(422).json({ error: 'PostExpired' });
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
