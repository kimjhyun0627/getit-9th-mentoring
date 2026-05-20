/**
 * 서재 목록 정렬 비교 함수 — `ShelfSortKey` 별로 in-memory 정렬 (#196).
 *
 * Prisma orderBy 만으로는 nullsLast (rating/completedAt) 와 book.title 컬럼 정렬을 일관되게
 * 표현하기 어렵다. 페이지 사이즈 ≤ 100 이라 in-memory 비용 무시 가능.
 *
 * 안정성: 동일 키 비교 시 addedAt desc 로 tie-break → deterministic.
 */

const addedDesc = (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();

const compareCompletedDesc = (a, b) => {
  const av = a.completedAt ? new Date(a.completedAt).getTime() : null;
  const bv = b.completedAt ? new Date(b.completedAt).getTime() : null;
  if (av === null && bv === null) return addedDesc(a, b);
  if (av === null) return 1; // null 은 뒤
  if (bv === null) return -1;
  if (bv !== av) return bv - av;
  return addedDesc(a, b);
};

const compareRatingDesc = (a, b) => {
  const av = typeof a.rating === 'number' ? a.rating : null;
  const bv = typeof b.rating === 'number' ? b.rating : null;
  if (av === null && bv === null) return addedDesc(a, b);
  if (av === null) return 1;
  if (bv === null) return -1;
  if (bv !== av) return bv - av;
  return addedDesc(a, b);
};

const compareTitleAsc = (a, b) => {
  const at = a.book?.title ?? '';
  const bt = b.book?.title ?? '';
  const cmp = at.localeCompare(bt, 'ko');
  return cmp !== 0 ? cmp : addedDesc(a, b);
};

/**
 * ShelfSortKey 문자열 → 비교 함수.
 *
 * @param {string} sortKey
 * @returns {(a: Record<string, any>, b: Record<string, any>) => number}
 */
export const compareBy = (sortKey) => {
  switch (sortKey) {
    case 'addedAt-asc':
      return (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
    case 'completedAt-desc':
      return compareCompletedDesc;
    case 'rating-desc':
      return compareRatingDesc;
    case 'title-asc':
      return compareTitleAsc;
    case 'addedAt-desc':
    default:
      return addedDesc;
  }
};
