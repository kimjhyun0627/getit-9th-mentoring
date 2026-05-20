/**
 * In-memory Prisma 모킹 보조 유틸 — `setup.js` 가 사용.
 *
 * - `compareBy`: Prisma `orderBy` (단일 객체 / 다중 키 배열) 를 정렬 비교 함수로
 * - `makeMatchWhere`: where 절을 in-memory row 에 적용 (equals/gt/gte/lt/lte + members.some)
 * - `PrismaUniqueViolation`: P2002 흉내 에러
 *
 * `setup.js` 300줄 cap 유지용 분리.
 */

/**
 * Prisma orderBy 를 단일 객체 또는 배열 형태로 받아 정렬 비교 함수를 만든다.
 * 지원 형태:
 *  - `{ field: 'asc' | 'desc' }`
 *  - `[{ field: 'asc' }, { other: 'desc' }, ...]` (다중 키)
 *
 * @param {Record<string, 'asc'|'desc'> | Array<Record<string, 'asc'|'desc'>> | undefined} orderBy
 * @returns {(a: any, b: any) => number}
 */
export const compareBy = (orderBy) => {
  const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  const keys = orders.flatMap((o) => Object.entries(o).map(([field, dir]) => ({ field, dir })));
  return (a, b) => {
    for (const { field, dir } of keys) {
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      const cmp = av > bv ? 1 : -1;
      return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  };
};

/**
 * memDb 클로저를 받아 matchWhere 함수를 만든다. Project.members.some 처리 때문에
 * memDb 참조가 필요 — 클로저 형태로 의존성을 끊는다.
 *
 * @param {{ projectMembers: Map<string, any> }} memDb
 * @returns {(row: Record<string, any>, where: Record<string, any> | undefined) => boolean}
 */
export const makeMatchWhere = (memDb) => {
  const matchWhere = (row, where) => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      // 복합 unique key (예: projectId_userId) — Prisma의 `{ projectId, userId }`
      if (k === 'projectId_userId' && v && typeof v === 'object') {
        return row.projectId === v.projectId && row.userId === v.userId;
      }
      // 관계 필터 (Project.members.some) — 메모리 컬렉션을 순회해서 매칭
      if (k === 'members' && v && typeof v === 'object' && v.some) {
        for (const m of memDb.projectMembers.values()) {
          if (m.projectId === row.id && matchWhere(m, v.some)) return true;
        }
        return false;
      }
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
        if ('equals' in v) return row[k] === v.equals;
        if ('gt' in v) return row[k] > v.gt;
        if ('gte' in v) return row[k] >= v.gte;
        if ('lt' in v) return row[k] < v.lt;
        if ('lte' in v) return row[k] <= v.lte;
        if ('in' in v) return Array.isArray(v.in) && v.in.includes(row[k]);
        return false;
      }
      return row[k] === v;
    });
  };
  return matchWhere;
};

/** Prisma `P2002` 흉내 (unique constraint violation). */
export class PrismaUniqueViolation extends Error {
  constructor(target) {
    super(`Unique constraint failed on the fields: ${target}`);
    this.name = 'PrismaClientKnownRequestError';
    this.code = 'P2002';
    this.meta = { target };
  }
}
