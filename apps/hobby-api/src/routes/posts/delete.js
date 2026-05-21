/**
 * DELETE /api/posts/:id — 본인 게시글 삭제.
 *
 * deleteMany + ownerId 조건으로 1회 쿼리. count === 1 이면 204.
 * 0 이면 존재 여부 재확인해서 404/403 분기.
 */
import { zodErrorBody } from '@getit/schemas/errors';
import { PostIdParam } from '@getit/schemas/hobby';

import { prisma } from '../../lib/prisma.js';

/**
 * Express handler: DELETE /api/posts/:id.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const deletePost = async (req, res, next) => {
  try {
    const parsedParam = PostIdParam.safeParse(req.params);
    if (!parsedParam.success) return res.status(400).json(zodErrorBody(parsedParam.error));

    const id = parsedParam.data.id;
    const result = await prisma.post.deleteMany({
      where: { id, ownerId: req.user.sub },
    });
    if (result.count === 1) return res.status(204).send();

    const exists = await prisma.post.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!exists) return res.status(404).json({ error: 'PostNotFound' });
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    return next(err);
  }
};
