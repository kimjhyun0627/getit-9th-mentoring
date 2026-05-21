/**
 * hobby-api 게시글 부가 mutation 라우터 — Phase 6c P2 신규 (#244/#245/#247/#333).
 *
 * posts.js 가 264 라인이라 cap (300) 근처. 신규 엔드포인트는 여기서 마운트.
 *
 * 엔드포인트:
 *  - PATCH  /api/posts/:id              — 방장 수정 (#333)
 *  - POST   /api/posts/:id/close        — 방장 모집 종료 (CLOSED 전이, #244)
 *  - GET    /api/posts/:id/applicants   — 방장용 신청자 목록 (#245)
 *  - POST   /api/posts/:id/no-shows     — 방장 노쇼 신고 (#247)
 *
 * 정책 공통:
 *  - 방장만 호출 가능. ownerId !== req.user.sub → 403.
 *  - 게시글 없음 → 404. 검증 실패 → 400 ValidationError.
 *  - CLOSED 전이는 멱등 (이미 CLOSED 면 200 OK + 변경 없음).
 *  - 노쇼 신고는 meetAt 이 지난 모임만. 그 전엔 422.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { NoShowReportInput, PostIdParam, PostUpdateInput } from '@getit/schemas/hobby';
import { Router } from 'express';

import { noShowReportedMessage, postClosedMessage } from '../lib/notificationMessages.js';
import { prisma } from '../lib/prisma.js';

import { serializePost } from './posts.serialize.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const normalizeTagNames = (raw) => {
  const seen = new Set();
  for (const t of raw) {
    const k = String(t).trim().toLowerCase();
    if (k) seen.add(k);
  }
  return [...seen];
};

/**
 * Owner-only 게이트. 게시글 존재 + ownerId 검증. 모두 통과 시 post 객체 반환.
 *
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<{ post: any, error?: 'NotFound' | 'Forbidden' }>}
 */
const requireOwnerPost = async (id, userId) => {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!post) return { post: null, error: 'NotFound' };
  if (post.ownerId !== userId) return { post, error: 'Forbidden' };
  return { post };
};

/**
 * @param {{ jwtSecret: string, mutationLimiter?: import('express').RequestHandler }} opts
 */
export const createPostMutationsRouter = ({ jwtSecret, mutationLimiter }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  const burstLimit = mutationLimiter ?? ((_req, _res, next) => next());

  // PATCH /api/posts/:id — 방장 수정 (#333)
  router.patch('/posts/:id', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const parsed = PostUpdateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const userId = req.user.sub;
      const { post, error } = await requireOwnerPost(parsedParam.data.id, userId);
      if (error === 'NotFound') return res.status(404).json({ error: 'PostNotFound' });
      if (error === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });
      if (post.status === 'CLOSED') {
        return res.status(422).json({ error: 'PostClosed' });
      }

      const { tags, capacity, applicationPolicy, ...rest } = parsed.data;
      // capacity 를 신청자 수보다 아래로 낮추는 건 금지 — 이미 신청한 사람이 잘리면 안 됨.
      if (typeof capacity === 'number' && capacity < post.currentCapacity) {
        return res.status(422).json({
          error: 'CapacityBelowApplicants',
          currentCapacity: post.currentCapacity,
        });
      }
      // #500: 정책 변경은 신청자 있으면 거부 (PENDING 처리/openChatUrl 노출 충돌 방지).
      // Gemini PR #510: 신청자 수 가져오지 말고 count 로 존재 여부만 체크.
      const policyChange =
        applicationPolicy && applicationPolicy !== (post.applicationPolicy ?? 'FIRST_COME');
      if (policyChange) {
        const appCount = await prisma.application.count({ where: { postId: post.id } });
        if (appCount > 0) return res.status(422).json({ error: 'PolicyChangeNotAllowed' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const data = { ...rest };
        if (typeof capacity === 'number') data.capacity = capacity;
        if (applicationPolicy) data.applicationPolicy = applicationPolicy;
        await tx.post.update({ where: { id: post.id }, data });

        if (Array.isArray(tags)) {
          // 전체 교체 — 기존 link 제거 후 새로 connectOrCreate.
          await tx.postTag.deleteMany?.({ where: { postId: post.id } });
          const names = normalizeTagNames(tags);
          for (const name of names) {
            await tx.tag.upsert({
              where: { name },
              create: { name },
              update: {},
            });
            const tag = await tx.tag.findUnique({ where: { name } });
            await tx.postTag.create?.({ data: { postId: post.id, tagId: tag.id } });
          }
        }

        // 정원을 currentCapacity 이상으로 올린 경우 FULL → RECRUITING 복귀.
        if (
          typeof capacity === 'number' &&
          capacity > post.currentCapacity &&
          post.status === 'FULL'
        ) {
          await tx.post.update({
            where: { id: post.id },
            data: { status: 'RECRUITING' },
          });
        }

        return tx.post.findUnique({
          where: { id: post.id },
          include: { tags: { include: { tag: true } } },
        });
      });

      return res.status(200).json({
        post: serializePost(updated, { exposeOpenChat: true, myApplication: null }),
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/posts/:id/close — 방장 모집 종료 (#244). 멱등.
  router.post('/posts/:id/close', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

      const userId = req.user.sub;
      const { post, error } = await requireOwnerPost(parsedParam.data.id, userId);
      if (error === 'NotFound') return res.status(404).json({ error: 'PostNotFound' });
      if (error === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });

      if (post.status === 'CLOSED') {
        return res.status(200).json({
          post: serializePost(post, { exposeOpenChat: true, myApplication: null }),
        });
      }

      // CR review #348: 상태 전이 + 알림 fan-out 을 원자 트랜잭션으로 묶음.
      // 동시 close 요청 → updateMany 조건부 ({ not: 'CLOSED' }) 로 1회만 알림 발생.
      const fresh = await prisma.$transaction(async (tx) => {
        const { count } = await tx.post.updateMany({
          where: { id: post.id, status: { not: 'CLOSED' } },
          data: { status: 'CLOSED' },
        });
        if (count === 1) {
          const applicants = await tx.application.findMany({
            where: { postId: post.id },
            select: { userId: true },
          });
          if (applicants.length) {
            await tx.notification.createMany({
              data: applicants.map(({ userId }) => ({
                userId,
                postId: post.id,
                kind: 'POST_CLOSED',
                message: postClosedMessage(post.title),
              })),
            });
          }
        }
        return tx.post.findUnique({
          where: { id: post.id },
          include: { tags: { include: { tag: true } } },
        });
      });
      return res.status(200).json({
        post: serializePost(fresh, { exposeOpenChat: true, myApplication: null }),
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/posts/:id/applicants — 방장용 신청자 목록 (#245).
  router.get('/posts/:id/applicants', auth, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

      const userId = req.user.sub;
      const { post, error } = await requireOwnerPost(parsedParam.data.id, userId);
      if (error === 'NotFound') return res.status(404).json({ error: 'PostNotFound' });
      if (error === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });

      const apps = await prisma.application.findMany({
        where: { postId: post.id },
      });
      // 노쇼 카운트 = 해당 userId 가 다른 모임에서 noShow=true 로 마크된 누적.
      const userIds = [...new Set(apps.map((a) => a.userId))];
      const noShowRows = userIds.length
        ? await prisma.application.findMany({
            where: { userId: { in: userIds }, noShow: true },
          })
        : [];
      const noShowCountByUser = new Map();
      for (const row of noShowRows) {
        noShowCountByUser.set(row.userId, (noShowCountByUser.get(row.userId) ?? 0) + 1);
      }

      const items = apps
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map((a) => ({
          id: a.id,
          userId: a.userId,
          // #500: status 노출 — FE 가 PENDING/APPROVED/REJECTED 분기 (승인/거절 버튼).
          status: a.status ?? 'APPROVED',
          createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
          noShow: Boolean(a.noShow),
          noShowCount: noShowCountByUser.get(a.userId) ?? 0,
        }));

      // policy 도 함께 응답 — FE 분기에서 별도 GET /posts/:id 호출 없이 처리 가능.
      return res.status(200).json({
        items,
        total: items.length,
        applicationPolicy: post.applicationPolicy ?? 'FIRST_COME',
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/posts/:id/no-shows — 방장 노쇼 신고 (#247).
  router.post('/posts/:id/no-shows', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
      const parsed = NoShowReportInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

      const userId = req.user.sub;
      const { post, error } = await requireOwnerPost(parsedParam.data.id, userId);
      if (error === 'NotFound') return res.status(404).json({ error: 'PostNotFound' });
      if (error === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });
      // meetAt 이 지난 모임만. 너무 일찍 신고하면 422.
      if (post.meetAt && new Date(post.meetAt) > new Date()) {
        return res.status(422).json({ error: 'PostNotEnded' });
      }

      const apps = await prisma.application.findMany({ where: { postId: post.id } });
      const idsToMark = new Set(parsed.data.applicantIds);
      const targets = apps.filter((a) => idsToMark.has(a.userId) && !a.noShow);

      // CR review #348: 노쇼 마크 + 알림 생성을 원자 트랜잭션 + 동시 가드 (noShow=false WHERE 조건).
      // 동시 신고 시에도 같은 application 에 대해 알림 1회만 발생.
      const updated = await prisma.$transaction(async (tx) => {
        let changed = 0;
        for (const a of targets) {
          const result = await tx.application.updateMany({
            where: { id: a.id, noShow: false },
            data: { noShow: true },
          });
          if (result.count === 1) {
            changed += 1;
            await tx.notification.create({
              data: {
                userId: a.userId,
                postId: post.id,
                kind: 'NO_SHOW_REPORTED',
                message: noShowReportedMessage(post.title),
              },
            });
          }
        }
        return changed;
      });
      return res.status(200).json({ updated });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
