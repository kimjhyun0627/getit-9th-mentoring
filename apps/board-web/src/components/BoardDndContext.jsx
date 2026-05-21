import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { computeDropOrder } from '../lib/cardMoveStrategy.js';

/**
 * 보드 전체 DnD 컨텍스트 (#274).
 *
 * 책임:
 *  - 카드 드래그 종료 시 source → target 컬럼 + 위치 계산
 *  - 부모(BoardViewPage)의 onMoveCard(cardId, sourceColumnId, targetColumnId, order) 호출
 *
 * - PointerSensor: 8px activation distance 로 의도치 않은 드래그 방지 (카드 클릭 → 편집 모달 보존)
 * - KeyboardSensor: a11y. 단 MoveMenu 가 keyboard-only fallback 으로 더 명확 → 보조용.
 * - collision: closestCorners — 컬럼/카드 혼합 droppable 에 안정적.
 *
 * data 규약:
 *  - 카드 sortable item: data.current = { type: 'card', columnId }
 *  - 컬럼 droppable: data.current = { type: 'column', columnId }
 *  - 빈 컬럼에 드롭하려면 columns 의 droppable 영역이 필요 — BoardColumn 이 useDroppable 사용.
 *
 * @param {{
 *   columns: Array<{ id: string; name: string; order: number }>;
 *   cardsByColumn: Record<string, Array<{ id: string; order: number; columnId: string }>>;
 *   onMoveCard: (cardId: string, sourceColumnId: string, targetColumnId: string, order: number) => void;
 *   children: import('react').ReactNode;
 * }} props
 */
export const BoardDndContext = ({ columns, cardsByColumn, onMoveCard, children }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** @param {import('@dnd-kit/core').DragEndEvent} event */
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current ?? {};
    if (activeData.type !== 'card') return;

    const cardId = String(active.id);
    const sourceColumnId = String(activeData.columnId ?? '');

    const overData = over.data.current ?? {};
    /** @type {string} */
    let targetColumnId;
    /** @type {string | null} */
    let overCardId;
    if (overData.type === 'column') {
      targetColumnId = String(overData.columnId ?? over.id);
      overCardId = null;
    } else if (overData.type === 'card') {
      targetColumnId = String(overData.columnId ?? '');
      overCardId = String(over.id);
    } else {
      return;
    }
    if (!targetColumnId) return;

    const sourceCards = cardsByColumn[sourceColumnId] ?? [];
    const targetCards = cardsByColumn[targetColumnId] ?? [];

    // same column + 빈 컬럼 = no-op 가드 (자기 자신만 있는 케이스).
    if (sourceColumnId === targetColumnId && targetCards.length <= 1 && !overCardId) return;

    const newOrder = computeDropOrder({
      activeCardId: cardId,
      sourceColumnId,
      sourceCards,
      targetColumnId,
      targetCards,
      overCardId,
    });
    if (newOrder === null) return;

    // 같은 컬럼에서 같은 위치로 이동하는 경우 (no-op) 가드.
    const currentCard = sourceCards.find((c) => c.id === cardId);
    if (
      currentCard &&
      sourceColumnId === targetColumnId &&
      Math.abs(currentCard.order - newOrder) < 1e-6
    ) {
      return;
    }

    onMoveCard(cardId, sourceColumnId, targetColumnId, newOrder);
  };

  // suppress unused warning
  void columns;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
};
