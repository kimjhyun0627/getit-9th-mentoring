/**
 * hobby-api 알림 라우터 — 본인 알림 조회 (#36).
 *
 * 엔드포인트:
 *  - GET /api/notifications — 본인(JWT sub) 알림만 최신순 + cursor 페이지네이션
 *
 * 정책:
 *  - 필터링은 항상 server-side 강제 (where.userId = req.user.sub). 클라가 userId
 *    쿼리 파라미터 박아도 무시 — 권한 우회 차단.
 *  - 정렬: createdAt desc, id desc (tie-break).
 *  - unreadOnly=true 면 readAt IS NULL 만.
 *  - cursor: 이전 페이지 마지막 id.
 *
 * 알림 생성은 applications.js 의 FULL 전이 훅에서 수행 — 여기선 read-only.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { NotificationListQuery } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const serializeNotification = (n) => ({
  id: n.id,
  userId: n.userId,
  postId: n.postId ?? null,
  kind: n.kind,
  message: n.message,
  createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
  readAt: n.readAt instanceof Date ? n.readAt.toISOString() : (n.readAt ?? null),
});

/**
 * 알림 라우터 생성.
 *
 * @param {{ jwtSecret: string }} opts
 * @returns {import('express').Router}
 */
export const createNotificationsRouter = ({ jwtSecret }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });

  router.get('/notifications', auth, async (req, res, next) => {
    try {
      const parsed = NotificationListQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { cursor, limit, unreadOnly } = parsed.data;
      const userId = req.user.sub;
      const onlyUnread = unreadOnly === 'true' || unreadOnly === '1';

      // server-side userId 강제. 클라가 query 로 보내도 무시.
      const where = { userId };
      if (onlyUnread) where.readAt = null;

      // cursor 선검증: 존재 + 본인 소유 여야 함. 안 그러면 Prisma 가 500 으로 흘러.
      // 잘못된 cursor 는 400 ValidationError 로 명확히 거부.
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

      return res.status(200).json({
        items: page.map(serializeNotification),
        nextCursor,
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
