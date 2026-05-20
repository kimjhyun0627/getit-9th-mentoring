/**
 * hobby-api 알림 라우터 — 본인 알림 조회 + 읽음 처리 (#36/#229).
 *
 * 엔드포인트:
 *  - GET   /api/notifications              — 본인 알림 최신순 + cursor 페이지네이션
 *  - PATCH /api/notifications/:id/read     — 단건 읽음 처리 (readAt 채움)
 *  - POST  /api/notifications/read-all     — 본인 unread 전체 읽음
 *
 * 정책:
 *  - 필터링은 항상 server-side 강제 (where.userId = req.user.sub). 권한 우회 차단.
 *  - 정렬: createdAt desc, id desc (tie-break).
 *  - unreadOnly=true 면 readAt IS NULL 만.
 *  - cursor: 이전 페이지 마지막 id (본인 소유 검증).
 *
 * 알림 생성은 applications.js 의 FULL 전이 훅에서 수행.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { NotificationListQuery } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const toIso = (d) => (d instanceof Date ? d.toISOString() : (d ?? null));

const serializeNotification = (n) => ({
  id: n.id,
  userId: n.userId,
  postId: n.postId ?? null,
  kind: n.kind,
  message: n.message,
  createdAt: toIso(n.createdAt),
  readAt: toIso(n.readAt),
});

/**
 * 알림 라우터 생성.
 *
 * @param {{ jwtSecret: string, mutationLimiter?: import('express').RequestHandler }} opts
 * @returns {import('express').Router}
 */
export const createNotificationsRouter = ({ jwtSecret, mutationLimiter }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  const burstLimit = mutationLimiter ?? ((_req, _res, next) => next());

  router.get('/notifications', auth, async (req, res, next) => {
    try {
      const parsed = NotificationListQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { cursor, limit, unreadOnly } = parsed.data;
      const userId = req.user.sub;
      const onlyUnread = unreadOnly === 'true' || unreadOnly === '1';

      const where = { userId };
      if (onlyUnread) where.readAt = null;

      if (cursor) {
        const ownsCursor = await prisma.notification.findUnique({
          where: { id: cursor },
        });
        if (!ownsCursor || ownsCursor.userId !== userId) {
          return res.status(400).json({
            error: 'ValidationError',
            issues: [{ path: 'cursor', message: '유효하지 않은 cursor' }],
          });
        }
      }

      const rows = await prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      // unread count (badge 용) — 별도 쿼리. 작은 cost 라 매번 계산해 보여줘.
      const unreadCount = await prisma.notification.count({
        where: { userId, readAt: null },
      });

      return res.status(200).json({
        items: page.map(serializeNotification),
        nextCursor,
        unreadCount,
      });
    } catch (err) {
      return next(err);
    }
  });

  // PATCH /api/notifications/:id/read — 단건 읽음 처리. 본인 소유 검증.
  // updateMany + where: { id, userId } 로 권한 + 존재 체크 한 번에 처리.
  router.patch('/notifications/:id/read', burstLimit, auth, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      if (!id || id.length > 64) {
        return res.status(400).json({ error: 'ValidationError' });
      }
      const userId = req.user.sub;
      const updated = await prisma.notification.updateMany({
        where: { id, userId, readAt: null },
        data: { readAt: new Date() },
      });
      if (updated.count === 0) {
        // 본인 소유 + unread 가 아니면 — 이미 읽었거나 없음. 정확한 분기는 follow-up read 로.
        const owns = await prisma.notification.findUnique({ where: { id } });
        if (!owns || owns.userId !== userId) {
          return res.status(404).json({ error: 'NotificationNotFound' });
        }
      }
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/notifications/read-all — 본인의 unread 전체를 읽음 처리.
  router.post('/notifications/read-all', burstLimit, auth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const updated = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return res.status(200).json({ updated: updated.count });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
