/**
 * Post 직렬화 — 카드/상세 공통.
 *
 * 분리 이유: posts.js 가 300줄 cap 에 닿아서 (#210/#212 변경 후) 직렬화 로직만 따로 뺌.
 *
 * 응답 필드:
 *  - 본문 필드 (id/ownerId/title/body/...)
 *  - tags: include.tags 평탄화 → [{ id, name }]
 *  - owner: ownerName 이 있으면 { nickname } 형태로 노출 (#210). null/빈문자열이면 키 자체 생략.
 *    스냅샷 컬럼은 #562 부터 nickname 우선 채워 (JWT.nickname ?? JWT.name) — FE 는 owner.nickname 만 보고 displayName 적용.
 *  - openChatUrl: opts.exposeOpenChat 일 때만 (#36 privacy).
 *  - myApplication: opts.myApplication 가 있으면 { id, createdAt } 포함 (#212).
 */

const toIso = (d) => (d instanceof Date ? d.toISOString() : d);

const flattenTags = (post) => {
  if (!Array.isArray(post.tags)) return [];
  return post.tags
    .map((row) => row.tag)
    .filter(Boolean)
    .map((t) => ({ id: t.id, name: t.name }));
};

/**
 * Post → 응답 직렬화.
 *
 * @param {object} post — Prisma Post row (include: { tags: { include: { tag: true } } })
 * @param {{
 *   exposeOpenChat?: boolean,
 *   myApplication?: { id: string, status?: string, createdAt: string } | null,
 * }} [opts]
 */
export const serializePost = (post, opts = {}) => {
  const { exposeOpenChat = false, myApplication = null } = opts;
  const base = {
    id: post.id,
    ownerId: post.ownerId,
    title: post.title,
    body: post.body,
    meetAt: toIso(post.meetAt),
    capacity: post.capacity,
    currentCapacity: post.currentCapacity,
    status: post.status,
    // #500: FE 가 정책별 UI 분기 (신청 토글 카피, 신청자 페이지 승인/거절 버튼).
    // 기본 FIRST_COME (Prisma default 가 보장하지만 row 가 undefined 인 fake-prisma 경로 방어).
    applicationPolicy: post.applicationPolicy ?? 'FIRST_COME',
    createdAt: toIso(post.createdAt),
    updatedAt: toIso(post.updatedAt),
    tags: flattenTags(post),
  };
  if (post.ownerName) base.owner = { nickname: post.ownerName };
  if (exposeOpenChat) base.openChatUrl = post.openChatUrl;
  if (myApplication) base.myApplication = myApplication;
  return base;
};
