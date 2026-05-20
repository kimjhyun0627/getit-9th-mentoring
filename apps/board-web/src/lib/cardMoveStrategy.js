/**
 * 카드 between-keys 이동 헬퍼 (FE optimistic 측에서만 사용).
 *
 * BE 는 같은 컬럼 내부 이동 시 `(prev + next)/2` 로 미세 조정하고,
 * 다른 컬럼 이동 시 order 미지정이면 끝에 +1000 으로 자동 배치한다.
 * FE optimistic 상에서는 단순화: order 명시 안 하면 끝에 붙는다고 가정한다.
 */

/** 자동 order 배치 간격 (BE 동일). */
export const ORDER_GAP = 1000;

/**
 * 대상 컬럼의 마지막 order + GAP 을 돌려준다.
 *
 * @param {Array<{ order: number }>} columnCards
 * @returns {number}
 */
export const appendOrder = (columnCards) => {
  if (!Array.isArray(columnCards) || columnCards.length === 0) return ORDER_GAP;
  const last = columnCards.reduce((acc, c) => (c.order > acc ? c.order : acc), -Infinity);
  if (!Number.isFinite(last)) return ORDER_GAP;
  return last + ORDER_GAP;
};

/**
 * optimistic 이동: 카드 배열에서 해당 카드를 빼고 대상 컬럼에 append.
 *
 * @template {{ id: string; columnId: string; order: number }} C
 * @param {C[]} cards
 * @param {string} cardId
 * @param {string} targetColumnId
 * @returns {C[]}
 */
export const optimisticMove = (cards, cardId, targetColumnId) => {
  const target = cards.find((c) => c.id === cardId);
  if (!target) return cards;
  const remaining = cards.filter((c) => c.id !== cardId);
  const targetCols = remaining.filter((c) => c.columnId === targetColumnId);
  const newOrder = appendOrder(targetCols);
  return [...remaining, { ...target, columnId: targetColumnId, order: newOrder }];
};
