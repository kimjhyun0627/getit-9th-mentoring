/**
 * GET /api/posts — 게시글 목록.
 *
 * 필터: status / tag / q (title+body contains) / timeWindow (today|week) + cursor 페이지네이션.
 * 응답: openChatUrl 마스킹 (#36), myApplication 배지 (#212).
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostListQuery } from '@getit/schemas/hobby';

import { loadMyApplicationsByPost } from '../../lib/applicationLookup.js';
import { prisma } from '../../lib/prisma.js';
import { meetAtRangeFor } from '../../lib/timeWindow.js';
import { serializePost } from '../posts.serialize.js';

/**
 * Express handler: GET /api/posts.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const listPosts = async (req, res, next) => {
  try {
    const parsed = PostListQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
    const { status, tag, q, timeWindow, cursor, limit } = parsed.data;
    const normalizedTag = tag?.trim().toLowerCase();
    const userId = req.user?.sub ?? null;

    const where = buildListWhere({ status, normalizedTag, q, timeWindow });

    // #267: 잘못된 cursor (존재하지 않거나 위조) 가 들어오면 Prisma findMany 가 500.
    // 사전에 존재 여부만 가볍게 확인 → 400 ValidationError 로 통일.
    if (cursor) {
      const exists = await prisma.post.findUnique({
        where: { id: cursor },
        select: { id: true },
      });
      if (!exists) {
        return res.status(400).json({
          error: 'ValidationError',
          issues: [{ path: 'cursor', message: '유효하지 않은 cursor' }],
        });
      }
    }

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

    // #212: 카드에서 "이미 신청한 모임" 배지를 보여주려면 한 번에 batch lookup 이 효율적.
    const myAppByPost = userId
      ? await loadMyApplicationsByPost(
          prisma,
          page.map((p) => p.id),
          userId,
        )
      : new Map();

    return res.status(200).json({
      items: page.map((p) =>
        serializePost(p, {
          exposeOpenChat: false,
          myApplication: myAppByPost.get(p.id) ?? null,
        }),
      ),
      nextCursor,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 검증 후 PostListQuery 값으로 Prisma where 객체 빌드.
 *
 * @param {{ status?: string, normalizedTag?: string, q?: string, timeWindow: 'all'|'today'|'week' }} params
 */
const buildListWhere = ({ status, normalizedTag, q, timeWindow }) => {
  const where = {};
  if (status) where.status = status;
  else where.status = { in: ['RECRUITING', 'FULL'] };
  if (normalizedTag) where.tags = { some: { tag: { name: normalizedTag } } };

  // #211: 과거 시각 모임은 list 에서 자동 제외.
  // 진행 중인 모임(시작 시각 30분 이내)도 마감 처리되도록 GRACE = 0.
  where.meetAt = { gt: new Date() };

  // #229: timeWindow 서버 필터 (today / week).
  const range = meetAtRangeFor(timeWindow, new Date());
  if (range) where.meetAt = { ...where.meetAt, ...range };

  // #229: q 검색 — title/body 부분 일치 (MySQL collation utf8mb4_unicode_ci → case-insensitive).
  if (q) where.OR = [{ title: { contains: q } }, { body: { contains: q } }];

  return where;
};
