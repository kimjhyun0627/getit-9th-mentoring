import { useState } from 'react';

import { reorderWithin } from '../../lib/cardMoveStrategy.js';
import { useBoardCardMutations } from '../../lib/useBoardCardMutations.js';

/**
 * BoardViewPage 의 카드 액션/state 묶음.
 *
 *  - 카드 create / move / reorder / delete / edit handler 와
 *    그에 딸린 transient state (addingColumnId / editingCardId / pendingDelete /
 *    editServerError) 를 한 곳에 모은다.
 *  - useBoardCardMutations 를 내부에서 호출 — page 본문은 이 hook 만 쓰면 됨.
 *
 * @param {{
 *   projectId: string;
 *   cardsByColumn: Record<string, Array<any>>;
 * }} args
 */
export const useCardActions = ({ projectId, cardsByColumn }) => {
  const [addingColumnId, setAddingColumnId] = useState(/** @type {string | null} */ (null));
  const [editingCardId, setEditingCardId] = useState(/** @type {string | null} */ (null));
  const [editServerError, setEditServerError] = useState(/** @type {string | null} */ (null));
  // 카드 삭제 confirm (#219)
  const [pendingDelete, setPendingDelete] = useState(
    /** @type {{ cardId: string; columnId: string; title: string } | null} */ (null),
  );

  const cardMut = useBoardCardMutations({
    projectId,
    onUpdateError: setEditServerError,
    onUpdateSuccess: () => {
      setEditingCardId(null);
      setEditServerError(null);
    },
  });

  const findCard = (cardId) =>
    Object.values(cardsByColumn)
      .flat()
      .find((c) => c.id === cardId);

  const handleAdd = (columnId, title) => {
    setAddingColumnId(columnId);
    cardMut.create.mutate({ columnId, title }, { onSettled: () => setAddingColumnId(null) });
  };
  // #274: 4번째 인자 order — DnD 에서는 between-keys 계산값을 BE 로 전달.
  // MoveMenu 경로는 기존처럼 order 미지정 → BE 가 끝에 append.
  const handleMove = (cardId, sourceColumnId, targetColumnId, order) => {
    cardMut.move.mutate({ cardId, sourceColumnId, targetColumnId, order });
  };
  // #219: 즉시 삭제 대신 확인 다이얼로그 후 mutate. UX-wise destructive 보호.
  const handleDelete = (cardId, columnId) => {
    const card = findCard(cardId);
    setPendingDelete({ cardId, columnId, title: card?.title ?? '' });
  };
  const handleConfirmDelete = () => {
    // 연타 가드: 진행중이면 무시. 실패 시 사용자 맥락 유지를 위해 onSuccess 에서만 다이얼로그 닫음.
    if (!pendingDelete || cardMut.remove.isPending) return;
    cardMut.remove.mutate(
      { cardId: pendingDelete.cardId, columnId: pendingDelete.columnId },
      { onSuccess: () => setPendingDelete(null) },
    );
  };

  const handleReorder = (cardId, direction) => {
    const card = findCard(cardId);
    if (!card) return;
    const columnCards = cardsByColumn[card.columnId] ?? [];
    const result = reorderWithin(columnCards, cardId, direction);
    if (!result) return;
    cardMut.move.mutate({
      cardId,
      sourceColumnId: card.columnId,
      targetColumnId: card.columnId,
      order: result.order,
    });
  };

  const handleEdit = (cardId) => {
    setEditingCardId(cardId);
    setEditServerError(null);
  };
  const handleSaveEdit = (cardId, changes) => {
    const card = findCard(cardId);
    if (!card) return;
    cardMut.update.mutate({ cardId, columnId: card.columnId, changes });
  };

  const closeEditModal = () => {
    setEditingCardId(null);
    setEditServerError(null);
  };

  const editingCard = editingCardId ? findCard(editingCardId) : null;

  return {
    cardMut,
    addingColumnId,
    editingCardId,
    editServerError,
    pendingDelete,
    editingCard,
    handleAdd,
    handleMove,
    handleDelete,
    handleConfirmDelete,
    handleReorder,
    handleEdit,
    handleSaveEdit,
    closeEditModal,
    closeDeleteDialog: () => setPendingDelete(null),
  };
};
