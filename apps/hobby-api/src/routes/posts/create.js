/**
 * POST /api/posts — 게시글 생성.
 *
 * 태그 다대다는 connectOrCreate 로 처리. 응답은 방장 자신이라 openChatUrl 노출.
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostCreateInput } from '@getit/schemas/hobby';

import { prisma } from '../../lib/prisma.js';
import { normalizeTagNames } from '../../lib/tagNormalize.js';
import { serializePost } from '../posts.serialize.js';

/**
 * Express handler: POST /api/posts.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const createPost = async (req, res, next) => {
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

    // #562: ownerName 스냅샷에 nickname 우선 — 라이브 신고 ("취미메이트는 사용자 이름
    // 말고 닉네임으로 뜨게"). JWT payload 의 nickname 은 trim 후 비어있지 않을 때만
    // 실리므로 (`buildAccessTokenPayload` 정책) 빈/공백 케이스는 자동으로 name 폴백.
    // 추가 방어: 직접 trim — 구버전 JWT 또는 외부 토큰 발급기가 trim 정책을 어겨도
    // ownerName 컬럼에 공백 문자열이 박혀 `if (post.ownerName)` 가 truthy 되는 일 방지
    // (Gemini medium #563). 모임은 단기성이라 닉네임 변경 시 stale 허용 (#212 동일 논리).
    const trimmedNickname = typeof req.user.nickname === 'string' ? req.user.nickname.trim() : '';
    const trimmedName = typeof req.user.name === 'string' ? req.user.name.trim() : '';
    const ownerSnapshot = trimmedNickname || trimmedName || null;
    const created = await prisma.post.create({
      data: {
        ownerId: req.user.sub,
        ownerName: ownerSnapshot,
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
};
