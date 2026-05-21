/**
 * hobby-api 게시글 라우터 — CRUD + 태그 다대다 + cursor 페이지네이션.
 *
 * 엔드포인트:
 *  - GET  /api/posts        — list (status/tag/q/timeWindow 필터 + cursor)
 *  - GET  /api/posts/:id    — detail (owner 만 openChatUrl 노출, myApplication 포함)
 *  - POST /api/posts        — create (JWT 필요)
 *  - DELETE /api/posts/:id  — delete (본인만, 타인 403)
 *
 * openChatUrl 마스킹 정책 (#36 — 프라이버시 강화):
 *  - list 응답: 항상 마스킹.
 *  - detail 응답: (요청자가 방장) OR (요청자가 신청 완료 + status === 'FULL') 일 때만 노출.
 *
 * 변경(#210/#211/#212/#230):
 *  - serializePost 가 owner.nickname 을 채움 (ownerName 스냅샷, null → 응답 owner 생략).
 *  - GET /api/posts 는 meetAt > now() 인 글만 노출 (status=CLOSED 미노출은 기존 정책).
 *  - GET /api/posts/:id 에 myApplication 포함 (요청자가 신청자인 경우).
 *  - GET /api/posts 가 q (검색) / timeWindow (today|week) 서버 필터 처리.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { PostCreateInput, PostIdParam, PostListQuery } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

import { serializePost } from './posts.serialize.js';

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
 * timeWindow 를 meetAt 범위 (gte/lt) 로 변환. KST 자정 기준.
 *
 * KST UTC+9 — 사용자 체감은 한국 시간 기준이지만 DB 는 UTC 저장.
 * 한국 자정 = UTC 15:00 (전날). 정확성을 위해 9시간 오프셋으로 자정 boundary 계산.
 *
 * @param {'all'|'today'|'week'} window
 * @param {Date} now
 * @returns {{ gte?: Date, lt?: Date } | null}
 */
export const meetAtRangeFor = (window, now) => {
  if (window === 'all') return null;
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  // now 를 KST 로 옮긴 뒤 자정 boundary 를 잡고 다시 UTC 로 환산.
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const kstMidnight = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()),
  );
  const startUtc = new Date(kstMidnight.getTime() - KST_OFFSET_MS);
  if (window === 'today') {
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
    return { gte: startUtc, lt: endUtc };
  }
  // 'week' — 오늘 자정부터 7일 뒤 자정 직전까지.
  const endUtc = new Date(startUtc.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { gte: startUtc, lt: endUtc };
};

/**
 * 게시글 라우터 생성.
 *
 * @param {{ jwtSecret: string, mutationLimiter?: import('express').RequestHandler }} opts
 * @returns {import('express').Router}
 */
export const createPostsRouter = ({ jwtSecret, mutationLimiter }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  const authOptional = requireAuth({ secret: jwtSecret, optional: true });
  const burstLimit = mutationLimiter ?? ((_req, _res, next) => next());

  // GET /api/posts — list
  router.get('/posts', authOptional, async (req, res, next) => {
    try {
      const parsed = PostListQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { status, tag, q, timeWindow, cursor, limit } = parsed.data;
      const normalizedTag = tag?.trim().toLowerCase();
      const userId = req.user?.sub ?? null;

      const where = {};
      if (status) where.status = status;
      else where.status = { in: ['RECRUITING', 'FULL'] };
      if (normalizedTag) where.tags = { some: { tag: { name: normalizedTag } } };

      // #211: 과거 시각 모임은 list 에서 자동 제외.
      // 진행 중인 모임(시작 시각 30분 이내)도 마감 처리되도록 GRACE = 0.
      where.meetAt = { gt: new Date() };

      // #229: timeWindow 서버 필터 적용 (today / week).
      const range = meetAtRangeFor(timeWindow, new Date());
      if (range) {
        where.meetAt = { ...where.meetAt, ...range };
      }

      // #229: q 검색 — title/body 부분 일치 (MySQL collation 이 utf8mb4_unicode_ci 라 case-insensitive).
      if (q) {
        where.OR = [{ title: { contains: q } }, { body: { contains: q } }];
      }

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

      // #212: list 응답에도 본인 신청 여부(myApplication)는 굳이 필요없지만,
      // 카드에서 "이미 신청한 모임" 배지를 보여주려면 한 번에 batch lookup 이 효율적.
      // 비로그인이면 skip.
      const myAppByPost = userId
        ? await loadMyApplicationsByPost(
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

      const userId = req.user?.sub;
      const isOwner = userId === post.ownerId;
      let myApplication = null;
      if (!isOwner && userId) {
        const applied = await prisma.application.findUnique({
          where: { postId_userId: { postId: post.id, userId } },
        });
        if (applied) {
          myApplication = {
            id: applied.id,
            status: applied.status ?? 'APPROVED',
            createdAt: toIso(applied.createdAt),
          };
        }
      }
      // openChatUrl 노출 정책 (#500):
      //  - 방장: 항상 노출.
      //  - APPROVAL 정책: 본인 신청이 APPROVED 상태일 때만 노출 (PENDING/REJECTED 는 X).
      //  - FIRST_COME 정책: status=FULL 일 때 본인이 신청자면 노출 (기존 동작).
      const isApproved = myApplication?.status === 'APPROVED';
      const isApprovalPolicy = (post.applicationPolicy ?? 'FIRST_COME') === 'APPROVAL';
      const isApplicantOnFull = Boolean(myApplication) && post.status === 'FULL' && isApproved;
      const isApprovedApplicant = isApprovalPolicy && isApproved;
      const exposeOpenChat = isOwner || isApplicantOnFull || isApprovedApplicant;
      // #500/Gemini PR #510: 방장에게는 신청자 존재 여부도 함께 — FE 가 EditPostPage 의
      // 정책 토글 disable 여부를 정확히 판단할 수 있게 (PENDING 도 카운트에 포함).
      let applicationCount;
      if (isOwner) {
        applicationCount = await prisma.application.count({ where: { postId: post.id } });
      }
      const serialized = serializePost(post, { exposeOpenChat, myApplication });
      if (typeof applicationCount === 'number') serialized.applicationCount = applicationCount;
      return res.status(200).json({ post: serialized });
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/posts — create
  router.post('/posts', burstLimit, auth, async (req, res, next) => {
    try {
      const parsed = PostCreateInput.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));
      const { title, body, meetAt, capacity, openChatUrl, tags, applicationPolicy } = parsed.data;

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
          ownerName: req.user.name ?? null,
          title,
          body,
          meetAt,
          capacity,
          openChatUrl,
          applicationPolicy: applicationPolicy ?? 'FIRST_COME',
          ...(tagBlock ? { tags: tagBlock } : {}),
        },
        include: { tags: { include: { tag: true } } },
      });

      return res
        .status(201)
        .json({ post: serializePost(created, { exposeOpenChat: true, myApplication: null }) });
    } catch (err) {
      return next(err);
    }
  });

  // DELETE /api/posts/:id — owner only.
  router.delete('/posts/:id', burstLimit, auth, async (req, res, next) => {
    try {
      const parsedParam = PostIdParam.safeParse(req.params);
      if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

      const id = parsedParam.data.id;
      const result = await prisma.post.deleteMany({
        where: { id, ownerId: req.user.sub },
      });
      if (result.count === 1) return res.status(204).send();

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

const toIso = (d) => (d instanceof Date ? d.toISOString() : d);

/**
 * post id 배열 + userId 로 Application 일괄 조회 → Map<postId, { id, createdAt }>.
 *
 * @param {string[]} postIds
 * @param {string} userId
 */
const loadMyApplicationsByPost = async (postIds, userId) => {
  const map = new Map();
  if (!postIds.length) return map;
  const rows = await prisma.application.findMany({
    where: { userId, postId: { in: postIds } },
    select: { id: true, postId: true, status: true, createdAt: true },
  });
  for (const r of rows) {
    map.set(r.postId, {
      id: r.id,
      status: r.status ?? 'APPROVED',
      createdAt: toIso(r.createdAt),
    });
  }
  return map;
};
