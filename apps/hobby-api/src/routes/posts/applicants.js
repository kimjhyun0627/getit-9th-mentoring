/**
 * GET /api/posts/:id/applicants — 방장용 신청자 목록 (#245).
 *
 * 각 신청자에 노쇼 누적 카운트(다른 모임 포함) + status (PENDING/APPROVED/REJECTED) 포함.
 * 응답에 applicationPolicy 도 같이 — FE 분기에서 별도 GET /posts/:id 호출 없이 처리.
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostIdParam } from '@getit/schemas/hobby';

import { requireOwnerPost, sendOwnerGateError } from '../../lib/ownerGate.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Express handler: GET /api/posts/:id/applicants.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const listApplicants = async (req, res, next) => {
  try {
    const parsedParam = PostIdParam.safeParse(req.params);
    if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

    const gate = await requireOwnerPost(prisma, parsedParam.data.id, req.user.sub);
    const gateRes = sendOwnerGateError(res, gate);
    if (gateRes) return gateRes;
    const { post } = gate;

    const apps = await prisma.application.findMany({ where: { postId: post.id } });
    const noShowCountByUser = await loadNoShowCounts(apps);

    const items = apps
      // CR #518: 동등 시 0 반환 — 동일 createdAt 입력에 대해 안정적 정렬.
      .sort((a, b) => {
        if (a.createdAt < b.createdAt) return -1;
        if (a.createdAt > b.createdAt) return 1;
        return 0;
      })
      .map((a) => ({
        id: a.id,
        userId: a.userId,
        // #500: status 노출 — FE 가 PENDING/APPROVED/REJECTED 분기 (승인/거절 버튼).
        status: a.status ?? 'APPROVED',
        createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
        noShow: Boolean(a.noShow),
        noShowCount: noShowCountByUser.get(a.userId) ?? 0,
      }));

    return res.status(200).json({
      items,
      total: items.length,
      applicationPolicy: post.applicationPolicy ?? 'FIRST_COME',
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 신청자별 노쇼 누적 카운트 = 해당 userId 가 다른 모임에서 noShow=true 로 마크된 누적.
 *
 * @param {Array<{ userId: string }>} apps
 * @returns {Promise<Map<string, number>>}
 */
const loadNoShowCounts = async (apps) => {
  const userIds = [...new Set(apps.map((a) => a.userId))];
  if (!userIds.length) return new Map();
  const rows = await prisma.application.findMany({
    where: { userId: { in: userIds }, noShow: true },
  });
  const counts = new Map();
  for (const row of rows) {
    counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
  }
  return counts;
};
