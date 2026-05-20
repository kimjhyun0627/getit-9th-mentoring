/**
 * 카드 between-keys 이동 헬퍼 (FE optimistic 측에서만 사용).
 *
 * BE 는 같은 컬럼 내부 이동 시 클라이언트가 보낸 order 를 그대로 사용하고
 * (between-keys 알고리즘: prev/next 평균), 다른 컬럼 이동에서 order 미지정이면
 * 끝에 +GAP 으로 자동 배치한다.
 *
 * - `optimisticMove(cards, cardId, targetColumnId, newOrder?)`: 다른 컬럼 → 끝에 append.
 *   같은 컬럼 안에서는 newOrder 명시 필요 (#214 회귀 가드).
 * - `reorderWithin(cards, cardId, direction)`: 같은 컬럼 안에서 1칸 위/아래 이동.
 *   `{ cardId, newOrder }` 또는 null (이미 끝) 반환.
 * - `betweenOrder(prev, next)`: 두 인접 order 의 사잇값 계산. null 허용 (끝/시작).
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
 * 두 인접 order 사이의 사잇값. null 은 "끝/시작" 의미.
 *
 * @param {number | null | undefined} prev
 * @param {number | null | undefined} next
 * @returns {number}
 */
export const betweenOrder = (prev, next) => {
  const hasPrev = typeof prev === 'number' && Number.isFinite(prev);
  const hasNext = typeof next === 'number' && Number.isFinite(next);
  if (hasPrev && hasNext) return (prev + next) / 2;
  if (hasPrev) return prev + ORDER_GAP;
  if (hasNext) return next - ORDER_GAP;
  return ORDER_GAP;
};

/**
 * 같은 컬럼 안에서 cardId 를 1칸 위/아래로 옮길 때의 새 order 계산.
 * 이미 양 끝이거나 카드를 못 찾으면 null 반환.
 *
 * @param {Array<{ id: string; columnId: string; order: number }>} cards
 * @param {string} cardId
 * @param {'up' | 'down'} direction
 * @returns {{ cardId: string; columnId: string; order: number } | null}
 */
export const reorderWithin = (cards, cardId, direction) => {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;
  const sameColumn = cards
    .filter((c) => c.columnId === card.columnId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const idx = sameColumn.findIndex((c) => c.id === cardId);
  if (idx === -1) return null;
  if (direction === 'up') {
    if (idx === 0) return null;
    const prev = sameColumn[idx - 2] ?? null; // 이동 후 위쪽 이웃
    const next = sameColumn[idx - 1]; // 이동 후 아래쪽 이웃 = 원래 바로 위 카드
    const order = betweenOrder(prev?.order ?? null, next.order);
    return { cardId, columnId: card.columnId, order };
  }
  // 'down'
  if (idx >= sameColumn.length - 1) return null;
  const prev = sameColumn[idx + 1]; // 이동 후 위쪽 이웃 = 원래 바로 아래 카드
  const next = sameColumn[idx + 2] ?? null; // 이동 후 아래쪽 이웃
  const order = betweenOrder(prev.order, next?.order ?? null);
  return { cardId, columnId: card.columnId, order };
};

/**
 * optimistic 이동: 카드 배열에서 해당 카드를 빼고 대상 컬럼에 배치.
 * - newOrder 명시 시 그대로 사용 (#214 same-column reorder 회귀 가드)
 * - 아니면 끝에 append
 *
 * @template {{ id: string; columnId: string; order: number }} C
 * @param {C[]} cards
 * @param {string} cardId
 * @param {string} targetColumnId
 * @param {number} [newOrder]
 * @returns {C[]}
 */
export const optimisticMove = (cards, cardId, targetColumnId, newOrder) => {
  const target = cards.find((c) => c.id === cardId);
  if (!target) return cards;
  const remaining = cards.filter((c) => c.id !== cardId);
  let order;
  if (typeof newOrder === 'number' && Number.isFinite(newOrder)) {
    order = newOrder;
  } else {
    const targetCols = remaining.filter((c) => c.columnId === targetColumnId);
    order = appendOrder(targetCols);
  }
  return [...remaining, { ...target, columnId: targetColumnId, order }];
};
