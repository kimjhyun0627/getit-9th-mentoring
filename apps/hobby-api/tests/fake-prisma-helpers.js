/**
 * FakePrisma 내부 헬퍼 — where 매처 + atomic update + tag expander.
 *
 * fake-prisma.js 에서 import. 라우터에서 쓰는 Prisma 패턴 추가 시 여기 확장.
 */

/**
 * Prisma where 절을 in-memory row 에 적용. 라우터에서 쓰는 연산자만 지원.
 * 지원:
 *  - 단순 동등
 *  - `{ contains, mode? }` (case-insensitive 기본)
 *  - `{ in: [...] }`
 *  - `{ lt | lte | gt | gte }` — 다중 조합 허용 ({ gt, lt } 동시).
 */
export const matchClause = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return Array.isArray(v.in) && v.in.includes(row[k]);
      if ('contains' in v) {
        const needle = String(v.contains);
        const haystack = String(row[k] ?? '');
        // MySQL utf8mb4_unicode_ci 가 case-insensitive — 그 동작에 맞춤.
        return haystack.toLowerCase().includes(needle.toLowerCase());
      }
      // `{ not: value }` — 단순 부등 / 또는 중첩 컬럼 필터.
      if ('not' in v) {
        const nv = v.not;
        if (nv !== null && typeof nv === 'object' && !(nv instanceof Date)) {
          // { not: { in: [...] } } 같은 중첩 — 재귀 호출.
          return !matchClause({ [k]: row[k] }, { [k]: nv });
        }
        return row[k] !== nv;
      }
      // 비교 연산자 다중 조합 ({ gt, lt } 등) 도 지원.
      const hasComparator = 'lt' in v || 'lte' in v || 'gt' in v || 'gte' in v;
      if (hasComparator) {
        if ('lt' in v && !(row[k] < v.lt)) return false;
        if ('lte' in v && !(row[k] <= v.lte)) return false;
        if ('gt' in v && !(row[k] > v.gt)) return false;
        if ('gte' in v && !(row[k] >= v.gte)) return false;
        return true;
      }
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
