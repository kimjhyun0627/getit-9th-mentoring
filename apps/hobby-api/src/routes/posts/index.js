/**
 * hobby-api 게시글 라우터 — CRUD + mutation.
 *
 * 분리 전엔 posts.js (302줄) + posts.mutations.js (300줄) 두 파일에 책임 혼재.
 * 엔드포인트별 핸들러 파일로 split, 이 index 는 mount 만.
 *
 * 엔드포인트:
 *  - GET    /api/posts                  list (status/tag/q/timeWindow 필터 + cursor)
 *  - GET    /api/posts/:id              detail (owner 만 openChatUrl 노출, myApplication 포함)
 *  - POST   /api/posts                  create (JWT 필요)
 *  - DELETE /api/posts/:id              delete (본인만, 타인 403)
 *  - PATCH  /api/posts/:id              방장 수정
 *  - POST   /api/posts/:id/close        방장 모집 종료 (CLOSED 전이, 멱등)
 *  - GET    /api/posts/:id/applicants   방장용 신청자 목록
 *  - POST   /api/posts/:id/no-shows     방장 노쇼 신고
 *
 * 정책 공통 (mutation 전체):
 *  - 방장만 호출 가능. ownerId !== req.user.sub → 403.
 *  - 게시글 없음 → 404. 검증 실패 → 400 ValidationError.
 *  - CLOSED 전이는 멱등 (이미 CLOSED 면 200 OK + 변경 없음).
 *  - 노쇼 신고는 meetAt 이 지난 모임만. 그 전엔 422.
 */
import { requireAuth } from '@getit/auth-utils/server';
import { Router } from 'express';

import { listApplicants } from './applicants.js';
import { closePost } from './close.js';
import { createPost } from './create.js';
import { deletePost } from './delete.js';
import { getPostDetail } from './detail.js';
import { listPosts } from './list.js';
import { reportNoShows } from './noShows.js';
import { updatePost } from './update.js';

/**
 * 게시글 라우터 생성. CRUD + mutation 통합.
 *
 * @param {{ jwtSecret: string, mutationLimiter?: import('express').RequestHandler }} opts
 * @returns {import('express').Router}
 */
export const createPostsRouter = ({ jwtSecret, mutationLimiter }) => {
  const router = Router();
  const auth = requireAuth({ secret: jwtSecret });
  const authOptional = requireAuth({ secret: jwtSecret, optional: true });
  const burstLimit = mutationLimiter ?? ((_req, _res, next) => next());

  router.get('/posts', authOptional, listPosts);
  router.get('/posts/:id', authOptional, getPostDetail);
  router.post('/posts', burstLimit, auth, createPost);
  router.patch('/posts/:id', burstLimit, auth, updatePost);
  router.delete('/posts/:id', burstLimit, auth, deletePost);
  router.post('/posts/:id/close', burstLimit, auth, closePost);
  router.get('/posts/:id/applicants', auth, listApplicants);
  router.post('/posts/:id/no-shows', burstLimit, auth, reportNoShows);

  return router;
};
