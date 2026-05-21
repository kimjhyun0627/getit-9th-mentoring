/**
 * hobby-api 신청 결정 — PATCH /api/applications/:id/approve|/reject (#500/#502).
 *
 * 정책:
 *  - APPROVAL 정책 모임에서만 의미 있음 (FIRST_COME 은 신청 시 이미 APPROVED).
 *  - 방장만 호출 가능. ownerId !== req.user.sub → 403.
 *  - PENDING → APPROVED (capacity 확보, FULL 도달 시 status 전이).
 *  - PENDING → REJECTED.
 *  - 멱등 X — 이미 APPROVED/REJECTED 면 422 (의도치 않은 상태 전이 차단).
 *
 * Race condition: approve 시 capacity 확보는 조건부 updateMany 로 atomic.
 *   같은 PENDING 두 개를 동시 approve 해도 capacity 오버되면 한쪽이 PostFull 거부.
 */
import {
  applicationApprovedMessage,
  applicationRejectedMessage,
  matchFullMessage,
} from '../lib/notificationMessages.js';

class BizReject extends Error {
  constructor(kind, extra = {}) {
    super(kind);
    this.kind = kind;
    this.extra = extra;
  }
}

const loadPendingApplication = async (tx, id, ownerId) => {
  const application = await tx.application.findUnique({ where: { id } });
  if (!application) throw new BizReject('NotFound');
  const post = await tx.post.findUnique({
    where: { id: application.postId },
    select: {
      id: true,
      ownerId: true,
      title: true,
      capacity: true,
      currentCapacity: true,
      status: true,
      meetAt: true,
      applicationPolicy: true,
    },
  });
  if (!post) throw new BizReject('NotFound');
  if (post.ownerId !== ownerId) throw new BizReject('Forbidden');
  if (post.applicationPolicy !== 'APPROVAL') throw new BizReject('PolicyMismatch');
  if (application.status !== 'PENDING') {
    throw new BizReject('NotPending', { status: application.status });
  }
  if (post.status === 'CLOSED') throw new BizReject('PostClosed');
  return { application, post };
};

/**
 * PATCH /api/applications/:id/approve — PENDING → APPROVED + 좌석 확보 + 알림.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} id Application.id
 * @param {string} ownerId 현재 사용자 (= 방장이어야 함)
 */
export const approveApplication = async (prisma, id, ownerId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const { application, post } = await loadPendingApplication(tx, id, ownerId);
      // CR PR #510: meetAt 지난 모임은 approve 금지 (apply 도 PostExpired 거부함).
      if (post.meetAt && new Date(post.meetAt) <= new Date()) {
        throw new BizReject('PostExpired');
      }
      // CR PR #510: 상태 전이를 조건부 update (status='PENDING') 로 원자화.
      // 같은 신청에 approve/reject 동시 요청이 들어와도 한쪽만 통과.
      const transition = await tx.application.updateMany({
        where: { id: application.id, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      if (transition.count === 0) {
        throw new BizReject('NotPending');
      }
      // 좌석 확보 — capacity 가 이미 도달했으면 거부 (다른 동시 approve 가 채웠을 수 있음).
      // 실패 시 트랜잭션 rollback 으로 status 도 PENDING 으로 복원.
      const seat = await tx.post.updateMany({
        where: {
          id: post.id,
          status: { not: 'CLOSED' },
          currentCapacity: { lt: post.capacity },
        },
        data: { currentCapacity: { increment: 1 } },
      });
      if (seat.count === 0) throw new BizReject('PostFull');

      // 신청자에게 APPROVED 알림.
      await tx.notification.create({
        data: {
          userId: application.userId,
          postId: post.id,
          kind: 'APPLICATION_APPROVED',
          message: applicationApprovedMessage(post.title),
        },
      });

      // capacity 도달 시 FULL 전이 + 모두에게 MATCH_FULL 알림 (기존 FIRST_COME 동작 일관).
      const fresh = await tx.post.findUnique({
        where: { id: post.id },
        select: { currentCapacity: true, capacity: true, status: true },
      });
      if (fresh && fresh.status === 'RECRUITING' && fresh.currentCapacity >= fresh.capacity) {
        await tx.post.update({ where: { id: post.id }, data: { status: 'FULL' } });
        const apps = await tx.application.findMany({
          where: { postId: post.id, status: 'APPROVED' },
          select: { userId: true },
        });
        const recipientSet = new Set(apps.map((a) => a.userId));
        recipientSet.add(post.ownerId);
        await tx.notification.createMany({
          data: [...recipientSet].map((uid) => ({
            userId: uid,
            postId: post.id,
            kind: 'MATCH_FULL',
            message: matchFullMessage(post.title),
          })),
        });
      }
      return { kind: 'Ok' };
    });
  } catch (err) {
    if (err instanceof BizReject) return { kind: err.kind, ...err.extra };
    throw err;
  }
};

/**
 * PATCH /api/applications/:id/reject — PENDING → REJECTED + 알림.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} id Application.id
 * @param {string} ownerId 현재 사용자 (= 방장이어야 함)
 */
export const rejectApplication = async (prisma, id, ownerId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const { application, post } = await loadPendingApplication(tx, id, ownerId);
      // CR PR #510: 상태 전이 원자화. approve/reject 동시 요청 시 한쪽만 통과.
      const transition = await tx.application.updateMany({
        where: { id: application.id, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      if (transition.count === 0) {
        throw new BizReject('NotPending');
      }
      await tx.notification.create({
        data: {
          userId: application.userId,
          postId: post.id,
          kind: 'APPLICATION_REJECTED',
          message: applicationRejectedMessage(post.title),
        },
      });
      return { kind: 'Ok' };
    });
  } catch (err) {
    if (err instanceof BizReject) return { kind: err.kind, ...err.extra };
    throw err;
  }
};

/**
 * 결정 결과 → HTTP 매핑.
 *
 * @param {import('express').Response} res
 * @param {{ kind: string, status?: string }} result
 */
export const respondDecision = (res, result) => {
  switch (result.kind) {
    case 'NotFound':
      return res.status(404).json({ error: 'ApplicationNotFound' });
    case 'Forbidden':
      return res.status(403).json({ error: 'Forbidden' });
    case 'PolicyMismatch':
      return res.status(422).json({ error: 'PolicyMismatch' });
    case 'NotPending':
      return res.status(422).json({ error: 'NotPending', status: result.status });
    case 'PostClosed':
      return res.status(422).json({ error: 'PostClosed' });
    case 'PostExpired':
      return res.status(422).json({ error: 'PostExpired' });
    case 'PostFull':
      return res.status(422).json({ error: 'PostFull' });
    case 'Ok':
      return res.status(200).json({ ok: true });
    default:
      return res.status(500).json({ error: 'InternalServerError' });
  }
};
