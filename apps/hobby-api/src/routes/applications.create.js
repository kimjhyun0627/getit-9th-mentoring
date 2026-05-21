/**
 * hobby-api 신청 생성 — POST /api/applications + 정책별 분기 (#500/#502).
 *
 * 정책 분기:
 *  - FIRST_COME: 기존 동작. 트랜잭션 안에서 좌석 확보 + Application(APPROVED) 생성.
 *    capacity 도달 시 status→FULL. 모두에게 MATCH_FULL 알림.
 *  - APPROVAL: 좌석 확보 안 함. Application(PENDING) 생성만. 방장에게 APPLICATION_PENDING 알림.
 *
 * Race condition (FIRST_COME): 낙관적 동시성 + 조건부 updateMany 로 atomic 좌석 확보.
 */
import { matchFullMessage, applicationPendingMessage } from '../lib/notificationMessages.js';

class BizReject extends Error {
  constructor(kind, extra = {}) {
    super(kind);
    this.kind = kind;
    this.extra = extra;
  }
}

const guardPostOpen = (post, userId) => {
  if (!post) throw new BizReject('NotFound');
  if (post.ownerId === userId) throw new BizReject('OwnerCannotApply');
  if (post.status !== 'RECRUITING') {
    throw new BizReject('PostNotOpen', { status: post.status });
  }
  if (post.meetAt && new Date(post.meetAt) <= new Date()) {
    throw new BizReject('PostExpired');
  }
};

// FIRST_COME 정책: 좌석 확보 + APPROVED Application + FULL 전이 hook.
const handleFirstCome = async (tx, post, userId) => {
  const seat = await tx.post.updateMany({
    where: {
      id: post.id,
      status: 'RECRUITING',
      currentCapacity: { lt: post.capacity },
    },
    data: { currentCapacity: { increment: 1 } },
  });
  if (seat.count === 0) throw new BizReject('PostFull');

  let application;
  try {
    application = await tx.application.create({
      data: { postId: post.id, userId, status: 'APPROVED' },
    });
  } catch (err) {
    if (err?.code === 'P2002') throw new BizReject('AlreadyApplied');
    throw err;
  }

  const fresh = await tx.post.findUnique({
    where: { id: post.id },
    select: { currentCapacity: true, capacity: true, status: true },
  });
  if (fresh && fresh.status === 'RECRUITING' && fresh.currentCapacity >= fresh.capacity) {
    await tx.post.update({ where: { id: post.id }, data: { status: 'FULL' } });
    const [ownerRow, apps] = await Promise.all([
      tx.post.findUnique({
        where: { id: post.id },
        select: { ownerId: true, title: true },
      }),
      tx.application.findMany({
        where: { postId: post.id, status: 'APPROVED' },
        select: { userId: true },
      }),
    ]);
    const recipientSet = new Set(apps.map((a) => a.userId));
    if (ownerRow?.ownerId) recipientSet.add(ownerRow.ownerId);
    await tx.notification.createMany({
      data: [...recipientSet].map((uid) => ({
        userId: uid,
        postId: post.id,
        kind: 'MATCH_FULL',
        message: matchFullMessage(ownerRow?.title),
      })),
    });
  }
  return application;
};

// APPROVAL 정책: PENDING Application + 방장에게 APPLICATION_PENDING 알림.
const handleApproval = async (tx, post, userId) => {
  let application;
  try {
    application = await tx.application.create({
      data: { postId: post.id, userId, status: 'PENDING' },
    });
  } catch (err) {
    if (err?.code === 'P2002') throw new BizReject('AlreadyApplied');
    throw err;
  }
  await tx.notification.create({
    data: {
      userId: post.ownerId,
      postId: post.id,
      kind: 'APPLICATION_PENDING',
      message: applicationPendingMessage(post.title),
    },
  });
  return application;
};

/**
 * POST /api/applications 핸들러 본체 — 트랜잭션 + 정책 분기.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} postId
 * @param {string} userId
 * @returns {Promise<{ kind: string, application?: any, status?: string }>}
 */
export const applyToPost = async (prisma, postId, userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          ownerId: true,
          title: true,
          capacity: true,
          status: true,
          meetAt: true,
          applicationPolicy: true,
        },
      });
      guardPostOpen(post, userId);

      // 중복 신청 사전 체크. 진짜 race 는 P2002 backstop.
      const existing = await tx.application.findUnique({
        where: { postId_userId: { postId, userId } },
      });
      if (existing) throw new BizReject('AlreadyApplied');

      const policy = post.applicationPolicy ?? 'FIRST_COME';
      const application =
        policy === 'APPROVAL'
          ? await handleApproval(tx, post, userId)
          : await handleFirstCome(tx, post, userId);
      return { kind: 'Ok', application };
    });
  } catch (err) {
    if (err instanceof BizReject) return { kind: err.kind, ...err.extra };
    throw err;
  }
};

/**
 * 결과 → HTTP status / body 매핑. 라우터에서 한 곳에서만 분기.
 *
 * @param {import('express').Response} res
 * @param {{ kind: string, application?: any, status?: string }} result
 * @param {(app: any) => any} serialize
 */
export const respondApply = (res, result, serialize) => {
  switch (result.kind) {
    case 'NotFound':
      return res.status(404).json({ error: 'PostNotFound' });
    case 'OwnerCannotApply':
      return res.status(409).json({ error: 'OwnerCannotApply' });
    case 'PostNotOpen':
      return res.status(422).json({ error: 'PostNotOpen', status: result.status });
    case 'PostFull':
      return res.status(422).json({ error: 'PostFull' });
    case 'PostExpired':
      return res.status(422).json({ error: 'PostExpired' });
    case 'AlreadyApplied':
      return res.status(409).json({ error: 'AlreadyApplied' });
    case 'Ok':
      return res.status(201).json({ application: serialize(result.application) });
    default:
      return res.status(500).json({ error: 'InternalServerError' });
  }
};
