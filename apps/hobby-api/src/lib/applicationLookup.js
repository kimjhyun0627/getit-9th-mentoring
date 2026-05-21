/**
 * post id 배열 + userId 로 Application 일괄 조회 → Map<postId, { id, status, createdAt }>.
 *
 * 카드(list) 응답에서 "이미 신청한 모임" 배지를 보여주려고 batch lookup. 비로그인일 땐 호출자가 skip.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string[]} postIds
 * @param {string} userId
 * @returns {Promise<Map<string, { id: string, status: string, createdAt: string }>>}
 */
export const loadMyApplicationsByPost = async (prisma, postIds, userId) => {
  const map = new Map();
  if (!postIds.length) return map;
  const rows = await prisma.application.findMany({
    where: { userId, postId: { in: postIds } },
    select: { id: true, postId: true, status: true, createdAt: true },
  });
  for (const r of rows) {
    map.set(r.postId, {
      id: r.id,
      status: r.status ?? 'APPROVED',
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    });
  }
  return map;
};
