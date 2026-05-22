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
import { zodErrorBody } from '@getit/schemas/errors';
import { MyApplicationListQuery, MyPostListQuery } from '@getit/schemas/hobby';
import { Router } from 'express';

import { prisma } from '../lib/prisma.js';

import { serializePost } from './posts.serialize.js';

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

  // GET /api/me — 현재 사용자 (JWT payload 의 화이트리스트 필드만).
  // FE 의 `getMe()` 가 `/api/me` 를 치는데 hobby-api 는 `/me/posts`, `/me/applications`
  // 만 있어서 404 가 떨어졌음. auth-api 와 동일하게 자기 토큰 정보를 반환한다.
  // OpenAPI 스펙(sub/email/name)과 일치 + JWT 표준 메타(iat/exp) 노출 차단.
  //
  // 무한 redirect fix: nickname / schoolVerifiedAt 도 echo. JWT payload 에 있을 때만
  // 키 값 채움 — FE 의 NicknameOnboardingGuard 가 onboarding 페이지로 보낼지 결정.
  router.get('/me', auth, (req, res) => {
    const { sub, email, name, nickname, schoolVerifiedAt } = req.user;
    return res.status(200).json({
      user: {
        sub,
        email,
        name,
        nickname: nickname ?? null,
        schoolVerifiedAt: schoolVerifiedAt ?? null,
      },
    });
  });

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
          const status = app.status ?? 'APPROVED';
          // openChatUrl 노출 정책 (#500):
          //  - 방장: 본인 모임이라 항상.
          //  - FIRST_COME 정책: post 가 FULL 이면 노출 (기존 동작).
          //  - APPROVAL 정책: 본인 신청이 APPROVED 일 때만.
          const isApprovalPolicy = (post.applicationPolicy ?? 'FIRST_COME') === 'APPROVAL';
          const isApprovedApplicant = status === 'APPROVED';
          const isApplicantOnFull = !isApprovalPolicy && post.status === 'FULL';
          const exposeOpenChat =
            isOwner || isApplicantOnFull || (isApprovalPolicy && isApprovedApplicant);
          return {
            id: app.id,
            postId: app.postId,
            status,
            createdAt: toIso(app.createdAt),
            post: serializePost(post, {
              exposeOpenChat,
              myApplication: { id: app.id, status, createdAt: toIso(app.createdAt) },
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
