/**
 * FakePrisma 내부 헬퍼 — where 매처 + atomic update + tag expander.
 *
 * fake-prisma.js 에서 import. 라우터에서 쓰는 Prisma 패턴 추가 시 여기 확장.
 */

/**
 * Prisma where 절을 in-memory row 에 적용. 라우터에서 쓰는 연산자만 지원.
 * 지원: 단순 동등, `{ contains }`, `{ in: [...] }`, `{ lt/lte/gt/gte }`.
 */
export const matchClause = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return Array.isArray(v.in) && v.in.includes(row[k]);
      if ('contains' in v) return String(row[k] ?? '').includes(v.contains);
      if ('lt' in v) return row[k] < v.lt;
      if ('lte' in v) return row[k] <= v.lte;
      if ('gt' in v) return row[k] > v.gt;
      if ('gte' in v) return row[k] >= v.gte;
      return false;
    }
    return row[k] === v;
  });
};

export const matchWhere = (row, where) => {
  if (!where) return true;
  const { AND, OR, NOT, ...rest } = where;
  if (!matchClause(row, rest)) return false;
  if (AND && Array.isArray(AND) && !AND.every((w) => matchWhere(row, w))) return false;
  if (OR && Array.isArray(OR) && !OR.some((w) => matchWhere(row, w))) return false;
  if (NOT && !!matchWhere(row, NOT)) return false;
  return true;
};

export const expandTagsOnPost = (memDb, post) => {
  const links = [...memDb.postTags.values()].filter((pt) => pt.postId === post.id);
  return {
    ...post,
    tags: links.map((pt) => ({
      tag: memDb.tags.get(pt.tagId) ? { ...memDb.tags.get(pt.tagId) } : null,
    })),
  };
};

/** Prisma atomic operator 풀이 (increment / decrement / set). */
export const applyAtomicUpdate = (row, data) => {
  const out = { ...row };
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('increment' in v) out[k] = (out[k] ?? 0) + v.increment;
      else if ('decrement' in v) out[k] = (out[k] ?? 0) - v.decrement;
      else if ('set' in v) out[k] = v.set;
      else out[k] = v;
    } else {
      out[k] = v;
    }
  }
  out.updatedAt = new Date();
  return out;
};
