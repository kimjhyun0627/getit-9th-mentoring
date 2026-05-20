/**
 * hobby-api 마이페이지 라우터 — 본인 게시글/신청 조회 (#228).
 *
 * 엔드포인트:
 *  - GET /api/me/posts          — 내가 만든 모임 (status 무관, CLOSED 포함)
 *  - GET /api/me/applications   — 내가 신청한 모임 (Application + Post join)
 *
 * 정책:
 *  - JWT 필수. userId 는 항상 req.user.sub 강제 (query 파라미터 무시).
 *  - cursor 페이지네이션 동일 패턴.
 *
 * 응답 형태:
 *  - posts: { items: Post[], nextCursor }  — serializePost 재사용
 *  - applications: { items: { id, createdAt, post: Post }[], nextCursor }
 */
import { requireAuth } from '@getit/auth-utils/server';
import { MyApplicationListQuery, MyPostListQuery } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

import { serializePost } from './posts.serialize.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

const toIso = (d) => (d instanceof Date ? d.toISOString() : d);

/**
 * 마이페이지 라우터 생성.
 *
 * @param {{ jwtSecret: string }} opts
 * @returns {import('express').Router}
 */
export const createMeRouter = ({ jwtSecret }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });

  // GET /api/me/posts — 본인 게시글. status 미지정 시 CLOSED 포함 전부.
  router.get('/me/posts', auth, async (req, res, next) => {
    try {
      const parsed = MyPostListQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { status, cursor, limit } = parsed.data;
      const userId = req.user.sub;

      const where = { ownerId: userId };
      if (status) where.status = status;

      const rows = await prisma.post.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      return res.status(200).json({
        items: page.map((p) =>
          // 본인 게시글이라 openChatUrl 노출.
          serializePost(p, { exposeOpenChat: true, myApplication: null }),
        ),
        nextCursor,
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/me/applications — 본인 신청 + 관련 Post.
  router.get('/me/applications', auth, async (req, res, next) => {
    try {
      const parsed = MyApplicationListQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { cursor, limit } = parsed.data;
      const userId = req.user.sub;

      const apps = await prisma.application.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = apps.length > limit;
      const page = hasMore ? apps.slice(0, limit) : apps;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      // post in batch (fake-prisma 호환 — Application.post relation 직접 include 대신 별도 조회).
      const postIds = [...new Set(page.map((a) => a.postId))];
      const posts = postIds.length
        ? await prisma.post.findMany({
            where: { id: { in: postIds } },
            include: { tags: { include: { tag: true } } },
          })
        : [];
      const byId = new Map(posts.map((p) => [p.id, p]));

      const items = page
        .map((app) => {
          const post = byId.get(app.postId);
          if (!post) return null;
          const isOwner = post.ownerId === userId;
          const isApplicantOnFull = post.status === 'FULL';
          return {
            id: app.id,
            postId: app.postId,
            createdAt: toIso(app.createdAt),
            post: serializePost(post, {
              exposeOpenChat: isOwner || isApplicantOnFull,
              myApplication: { id: app.id, createdAt: toIso(app.createdAt) },
            }),
          };
        })
        .filter(Boolean);

      return res.status(200).json({ items, nextCursor });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
