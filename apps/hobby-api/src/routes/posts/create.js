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

    const created = await prisma.post.create({
      data: {
        ownerId: req.user.sub,
        ownerName: req.user.name ?? null,
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
