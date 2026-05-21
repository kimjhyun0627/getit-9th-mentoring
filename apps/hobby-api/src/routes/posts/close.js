/**
 * POST /api/posts/:id/close — 방장 모집 종료 (#244). 멱등.
 *
 * 상태 전이 + 신청자 알림 fan-out 을 원자 트랜잭션으로 묶음 (#348 review).
 * 동시 close 요청 → updateMany({ status: { not: 'CLOSED' } }) 로 1회만 알림 발생.
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostIdParam } from '@getit/schemas/hobby';

import { postClosedMessage } from '../../lib/notificationMessages.js';
import { requireOwnerPost, sendOwnerGateError } from '../../lib/ownerGate.js';
import { prisma } from '../../lib/prisma.js';
import { serializePost } from '../posts.serialize.js';

/**
 * Express handler: POST /api/posts/:id/close.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const closePost = async (req, res, next) => {
  try {
    const parsedParam = PostIdParam.safeParse(req.params);
    if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

    const gate = await requireOwnerPost(prisma, parsedParam.data.id, req.user.sub);
    const gateRes = sendOwnerGateError(res, gate);
    if (gateRes) return gateRes;
    const { post } = gate;

    if (post.status === 'CLOSED') {
      return res.status(200).json({
        post: serializePost(post, { exposeOpenChat: true, myApplication: null }),
      });
    }

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
};
