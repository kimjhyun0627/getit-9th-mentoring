/**
 * 방장(owner)-only 게이트.
 *
 * mutation 라우터(update/close/applicants/no-shows) 공통: 게시글 존재 + ownerId === userId 검증.
 *
 * 반환:
 *  - { post } : 정상. post 는 tags include 포함된 Post row.
 *  - { post: null, error: 'NotFound' } : 게시글 없음.
 *  - { post, error: 'Forbidden' } : 방장 아님.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<{ post: any, error?: 'NotFound' | 'Forbidden' }>}
 */
export const requireOwnerPost = async (prisma, id, userId) => {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!post) return { post: null, error: 'NotFound' };
  if (post.ownerId !== userId) return { post, error: 'Forbidden' };
  return { post };
};

/**
 * requireOwnerPost 결과를 Express 응답으로 변환. 정상이면 null 반환.
 *
 * @param {import('express').Response} res
 * @param {{ post: any, error?: 'NotFound' | 'Forbidden' }} result
 * @returns {import('express').Response|null}
 */
export const sendOwnerGateError = (res, result) => {
  if (result.error === 'NotFound') return res.status(404).json({ error: 'PostNotFound' });
  if (result.error === 'Forbidden') return res.status(403).json({ error: 'Forbidden' });
  return null;
};
