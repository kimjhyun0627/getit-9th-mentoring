/**
 * hobby-api 게시글 라우터 — CRUD + 태그 다대다 + cursor 페이지네이션.
 *
 * 엔드포인트:
 *  - GET  /api/posts        — list (status/tag 필터 + cursor)
 *  - GET  /api/posts/:id    — detail (owner 만 openChatUrl 노출)
 *  - POST /api/posts        — create (JWT 필요)
 *  - DELETE /api/posts/:id  — delete (본인만, 타인 403)
 *
 * openChatUrl 마스킹 정책 (이 PR scope 의 1차 보호선 — #36 에서 더 정교화):
 *  - list 응답: 항상 마스킹.
 *  - detail 응답: 요청자가 owner 이거나 status === 'FULL' 일 때만 노출.
 *
 * Race condition / Privacy 의 더 강한 보호선은 후속 이슈 (#35 / #36) 에서 다룸.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { PostCreateInput, PostIdParam, PostListQuery } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

const zodErrorBody = (err) => ({
  error: 'ValidationError',
  issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
});

/**
 * 태그 이름 정규화 — trim + 소문자. 같은 이름의 중복 entry 도 제거.
 *
 * @param {string[]} raw
 * @returns {string[]}
 */
const normalizeTagNames = (raw) => {
  const seen = new Set();
  for (const t of raw) {
    const k = t.trim().toLowerCase();
    if (k) seen.add(k);
  }
  return [...seen];
};

/**
 * Post → 응답 직렬화. include.tags 모양을 평탄화.
 *
 * @param {object} post
 * @param {{ exposeOpenChat?: boolean }} [opts]
 */
const serializePost = (post, opts = {}) => {
  const { exposeOpenChat = false } = opts;
  const tags = Array.isArray(post.tags)
    ? post.tags
        .map((row) => row.tag)
        .filter(Boolean)
        .map((t) => ({ id: t.id, name: t.name }))
    : [];
  const base = {
    id: post.id,
    ownerId: post.ownerId,
    title: post.title,
    body: post.body,
    meetAt: post.meetAt instanceof Date ? post.meetAt.toISOString() : post.meetAt,
    capacity: post.capacity,
    currentCapacity: post.currentCapacity,
    status: post.status,
    createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
    updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt,
    tags,
  };
  if (exposeOpenChat) base.openChatUrl = post.openChatUrl;
  return base;
};

/**
 * 게시글 라우터 생성.
 *
 * @param {{ jwtSecret: string }} opts
 * @returns {import('express').Router}
 */
export const createPostsRouter = ({ jwtSecret }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  const authOptional = requireAuth({ secret: jwtSecret, optional: true });

  // GET /api/posts — list
  router.get('/posts', async (req, res, next) => {
    try {
      const parsed = PostListQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { status, tag, cursor, limit } = parsed.data;
      // 생성 측 (POST /api/posts) 의 태그 정규화 (trim + lowercase) 와 동일 규칙
      // 으로 검색해야 결과가 비지 않음. 한 곳만 어긋나면 사용자 체감으론 "버그".
      const normalizedTag = tag?.trim().toLowerCase();

      const where = {};
      if (status) where.status = status;
      else where.status = { in: ['RECRUITING', 'FULL'] };
      if (normalizedTag) where.tags = { some: { tag: { name: normalizedTag } } };

      // limit+1 fetch 로 nextCursor 판별.
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
        items: page.map((p) => serializePost(p, { exposeOpenChat: false })),
        nextCursor,
      });
    } catch (err) {
      return next(err);
    }
  });

  // GET /api/posts/:id — detail (auth optional → req.user 있으면 owner 판정)
  router.get('/posts/:id', authOptional, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

      const post = await prisma.post.findUnique({
        where: { id: parsedParam.data.id },
        include: { tags: { include: { tag: true } } },
      });
      if (!post) return res.status(404).json({ error: 'PostNotFound' });

      const isOwner = req.user?.sub === post.ownerId;
      const exposeOpenChat = isOwner || post.status === 'FULL';
      return res.status(200).json({ post: serializePost(post, { exposeOpenChat }) });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/posts — create
  router.post('/posts', auth, async (req, res, next) => {
    try {
      const parsed = PostCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { title, body, meetAt, capacity, openChatUrl, tags } = parsed.data;

      const tagNames = normalizeTagNames(tags);
      const tagBlock = tagNames.length
        ? {
            create: tagNames.map((name) => ({
              tag: { connectOrCreate: { where: { name }, create: { name } } },
            })),
          }
        : undefined;

      const created = await prisma.post.create({
        data: {
          ownerId: req.user.sub,
          title,
          body,
          meetAt,
          capacity,
          openChatUrl,
          ...(tagBlock ? { tags: tagBlock } : {}),
        },
        include: { tags: { include: { tag: true } } },
      });

      return res.status(201).json({ post: serializePost(created, { exposeOpenChat: true }) });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/posts/:id — owner only.
  //
  // TOCTOU 회피: findUnique → delete 분리하면 그 사이 다른 요청이 같은 글을
  // 지웠을 때 Prisma 가 P2025 를 던져서 500 으로 흐름. 대신 `deleteMany` 로
  // (id, ownerId) 조건을 한 번에 걸고, count 0 일 때 404/403 분기.
  router.delete('/posts/:id', auth, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

      const id = parsedParam.data.id;
      const result = await prisma.post.deleteMany({
        where: { id, ownerId: req.user.sub },
      });
      if (result.count === 1) return res.status(204).send();

      // count 0 — id 자체가 없거나, 있는데 owner 가 아니거나. 둘 다 동시 race 가능.
      // 정확한 분기를 위해 별도 lookup 으로 404/403 구분.
      const exists = await prisma.post.findUnique({
        where: { id },
        select: { ownerId: true },
      });
      if (!exists) return res.status(404).json({ error: 'PostNotFound' });
      return res.status(403).json({ error: 'Forbidden' });
    } catch (err) {
      return next(err);
    }
  });

  return router;
};
