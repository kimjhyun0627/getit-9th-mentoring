/**
 * PATCH /api/posts/:id — 방장 게시글 수정 (#333).
 *
 * 정책:
 *  - CLOSED 게시글은 수정 불가 (422).
 *  - capacity 를 currentCapacity 아래로 낮추는 건 금지 (422).
 *  - applicationPolicy 변경은 신청자 있으면 거부 (#500).
 *  - capacity 가 currentCapacity 초과 + status=FULL 이면 RECRUITING 복귀.
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostIdParam, PostUpdateInput } from '@getit/schemas/hobby';

import { requireOwnerPost, sendOwnerGateError } from '../../lib/ownerGate.js';
import { prisma } from '../../lib/prisma.js';
import { normalizeTagNames } from '../../lib/tagNormalize.js';
import { serializePost } from '../posts.serialize.js';

/**
 * Express handler: PATCH /api/posts/:id.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const updatePost = async (req, res, next) => {
  try {
    const parsedParam = PostIdParam.safeParse(req.params);
    if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));
    const parsed = PostUpdateInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErrorBody(parsed.error));

    const gate = await requireOwnerPost(prisma, parsedParam.data.id, req.user.sub);
    const gateRes = sendOwnerGateError(res, gate);
    if (gateRes) return gateRes;
    const { post } = gate;
    if (post.status === 'CLOSED') return res.status(422).json({ error: 'PostClosed' });

    const { tags, capacity, applicationPolicy, ...rest } = parsed.data;
    if (typeof capacity === 'number' && capacity < post.currentCapacity) {
      return res.status(422).json({
        error: 'CapacityBelowApplicants',
        currentCapacity: post.currentCapacity,
      });
    }
    const policyChange =
      applicationPolicy && applicationPolicy !== (post.applicationPolicy ?? 'FIRST_COME');

    const txResult = await runUpdateTransaction({
      post,
      patch: { rest, tags, capacity, applicationPolicy },
      policyChange,
    });
    if (txResult && typeof txResult === 'object' && 'error' in txResult) {
      return res.status(422).json({ error: txResult.error });
    }
    return res.status(200).json({
      post: serializePost(txResult, { exposeOpenChat: true, myApplication: null }),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 단일 트랜잭션: policy guard + Post update + tag 재교체 + FULL→RECRUITING 복귀.
 *
 * @param {object} args
 * @param {any} args.post — fetch 시점의 Post row (currentCapacity/status 비교용).
 * @param {object} args.patch — { rest, tags, capacity, applicationPolicy }.
 * @param {boolean} args.policyChange — applicationPolicy 변경 여부.
 */
const runUpdateTransaction = ({ post, patch, policyChange }) =>
  prisma.$transaction(async (tx) => {
    if (policyChange) {
      // 같은 트랜잭션 안에서 count 후 update — sibling commit 보이지 않게 SnapShot 일관성 보장.
      const appCount = await tx.application.count({ where: { postId: post.id } });
      if (appCount > 0) return { error: 'PolicyChangeNotAllowed' };
    }

    const { rest, tags, capacity, applicationPolicy } = patch;
    const data = { ...rest };
    if (typeof capacity === 'number') data.capacity = capacity;
    if (applicationPolicy) data.applicationPolicy = applicationPolicy;
    // 정원을 currentCapacity 이상으로 올린 경우 FULL → RECRUITING 복귀.
    // 일반 필드 업데이트와 같은 update 호출에 묶어 DB round-trip 1회 (Gemini #518 review).
    if (typeof capacity === 'number' && capacity > post.currentCapacity && post.status === 'FULL') {
      data.status = 'RECRUITING';
    }
    await tx.post.update({ where: { id: post.id }, data });

    if (Array.isArray(tags)) await replaceTags(tx, post.id, tags);

    return tx.post.findUnique({
      where: { id: post.id },
      include: { tags: { include: { tag: true } } },
    });
  });

const replaceTags = async (tx, postId, tags) => {
  await tx.postTag.deleteMany({ where: { postId } });
  const names = normalizeTagNames(tags);
  for (const name of names) {
    // upsert 가 생성/업데이트된 row 를 반환하므로 별도 findUnique 불필요 (Gemini #518 review).
    const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} });
    await tx.postTag.create({ data: { postId, tagId: tag.id } });
  }
};
