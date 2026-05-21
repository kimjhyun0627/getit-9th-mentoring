/**
 * GET /api/posts/:id — 게시글 상세.
 *
 * openChatUrl 노출 정책 (#36 / #500):
 *  - 방장: 항상 노출.
 *  - APPROVAL 정책: 본인 신청이 APPROVED 상태일 때만.
 *  - FIRST_COME 정책: status=FULL 일 때 본인이 신청자(APPROVED)면.
 *
 * 방장에게는 applicationCount 도 함께 (FE 가 EditPostPage 의 정책 토글 disable 판단).
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostIdParam } from '@getit/schemas/hobby';

import { prisma } from '../../lib/prisma.js';
import { serializePost } from '../posts.serialize.js';

const toIso = (d) => (d instanceof Date ? d.toISOString() : d);

/**
 * Express handler: GET /api/posts/:id.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const getPostDetail = async (req, res, next) => {
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
    const myApplication = await loadMyApplication(post.id, userId, isOwner);

    const exposeOpenChat = shouldExposeOpenChat({ isOwner, post, myApplication });
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
};

const loadMyApplication = async (postId, userId, isOwner) => {
  if (isOwner || !userId) return null;
  const applied = await prisma.application.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (!applied) return null;
  return {
    id: applied.id,
    status: applied.status ?? 'APPROVED',
    createdAt: toIso(applied.createdAt),
  };
};

const shouldExposeOpenChat = ({ isOwner, post, myApplication }) => {
  if (isOwner) return true;
  const isApproved = myApplication?.status === 'APPROVED';
  const isApprovalPolicy = (post.applicationPolicy ?? 'FIRST_COME') === 'APPROVAL';
  const isApplicantOnFull = Boolean(myApplication) && post.status === 'FULL' && isApproved;
  const isApprovedApplicant = isApprovalPolicy && isApproved;
  return isApplicantOnFull || isApprovedApplicant;
};
