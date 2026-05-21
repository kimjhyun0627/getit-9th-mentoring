/**
 * POST /api/posts/:id/no-shows — 방장 노쇼 신고 (#247).
 *
 * - meetAt 이 지난 모임만. 그 전엔 422.
 * - 노쇼 마크 + 알림을 같은 트랜잭션 + 동시 가드 (noShow=false WHERE 조건).
 *   동시 신고 시에도 같은 application 알림 1회만 발생.
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { NoShowReportInput, PostIdParam } from '@getit/schemas/hobby';

import { noShowReportedMessage } from '../../lib/notificationMessages.js';
import { requireOwnerPost, sendOwnerGateError } from '../../lib/ownerGate.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Express handler: POST /api/posts/:id/no-shows.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const reportNoShows = async (req, res, next) => {
  try {
    const parsedParam = PostIdParam.safeParse(req.params);
    if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
    const parsed = NoShowReportInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

    const gate = await requireOwnerPost(prisma, parsedParam.data.id, req.user.sub);
    const gateRes = sendOwnerGateError(res, gate);
    if (gateRes) return gateRes;
    const { post } = gate;
    if (post.meetAt && new Date(post.meetAt) > new Date()) {
      return res.status(422).json({ error: 'PostNotEnded' });
    }

    const apps = await prisma.application.findMany({ where: { postId: post.id } });
    const idsToMark = new Set(parsed.data.applicantIds);
    const targets = apps.filter((a) => idsToMark.has(a.userId) && !a.noShow);

    const updated = await prisma.$transaction(async (tx) => {
      let changed = 0;
      for (const a of targets) {
        const result = await tx.application.updateMany({
          where: { id: a.id, noShow: false },
          data: { noShow: true },
        });
        if (result.count === 1) {
          changed += 1;
          await tx.notification.create({
            data: {
              userId: a.userId,
              postId: post.id,
              kind: 'NO_SHOW_REPORTED',
              message: noShowReportedMessage(post.title),
            },
          });
        }
      }
      return changed;
    });
    return res.status(200).json({ updated });
  } catch (err) {
    return next(err);
  }
};
