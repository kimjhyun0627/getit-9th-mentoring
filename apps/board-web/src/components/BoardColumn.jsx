import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';

import { cn } from '../lib/cn.js';

import { BoardColumnHeader } from './BoardColumnHeader.jsx';
import { CardComposer } from './CardComposer.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { KanbanCard } from './KanbanCard.jsx';

/**
 * 보드 컬럼 1개 — 헤더 + 카드 리스트 + 인라인 컴포저 (#206 컬럼 rename/delete 포함).
 *
 * @param {{
 *   column: { id: string; name: string; order: number };
 *   cards: Array<{
 *     id: string;
 *     columnId: string;
 *     title: string;
 *     description?: string | null;
 *     assigneeId?: string | null;
 *     order: number;
 *   }>;
 *   otherColumns: Array<{ id: string; name: string }>;
 *   onAddCard: (title: string) => void;
 *   onMoveCard: (cardId: string, targetColumnId: string) => void;
 *   onDeleteCard: (cardId: string) => void;
 *   onEditCard?: (cardId: string) => void;
 *   onReorderCard?: (cardId: string, direction: 'up' | 'down') => void;
 *   memberNameByUserId?: Record<string, string | null>;
 *   isAddingCard?: boolean;
 *   isLoading?: boolean;
 *   onRenameColumn?: (name: string) => void;
 *   onDeleteColumn?: () => void;
 *   canDeleteColumn?: boolean;
 * }} props
 */
export const BoardColumn = ({
  column,
  cards,
  otherColumns,
  onAddCard,
  onMoveCard,
  onDeleteCard,
  onEditCard,
  onReorderCard,
  memberNameByUserId = {},
  isAddingCard = false,
  isLoading = false,
  onRenameColumn,
  onDeleteColumn,
  canDeleteColumn = true,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  // #274: DnD — 컬럼 자체를 droppable 로, 카드 리스트를 SortableContext 로.
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { type: 'column', columnId: column.id },
  });
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  return (
    <section aria-label={`${column.name} 컬럼`} className="flex flex-col bg-background">
      <BoardColumnHeader
        column={column}
        cardCount={cards.length}
        onRename={onRenameColumn}
        onDelete={onDeleteColumn ? () => setConfirmDelete(true) : undefined}
        canDelete={canDeleteColumn}
      />

      {isLoading ? (
        <div className="px-5 py-6" role="status" aria-label={`${column.name} 카드 불러오는 중`}>
          {['a', 'b'].map((slot) => (
            <div key={slot} className="mb-2 h-12 animate-pulse rounded-md bg-foreground/[0.04]" />
          ))}
        </div>
      ) : (
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <ul
            ref={setDroppableRef}
            data-testid={`column-droppable-${column.id}`}
            className={cn('card-stack flex flex-col transition', isOver && 'bg-foreground/[0.02]')}
          >
            {cards.length === 0 ? (
              // #282: composer 와 중복 카피 제거. 시각적 여백만 유지.
              <li
                aria-hidden="true"
                className="px-5 py-2 text-center text-[11px] text-muted-foreground/0"
              >
                &nbsp;
              </li>
            ) : (
              cards.map((card, idx) => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  columnName={column.name}
                  otherColumns={otherColumns}
                  onMove={(targetColumnId) => onMoveCard(card.id, targetColumnId)}
                  onDelete={() => onDeleteCard(card.id)}
                  onEdit={onEditCard ? () => onEditCard(card.id) : undefined}
                  onReorder={
                    onReorderCard ? (direction) => onReorderCard(card.id, direction) : undefined
                  }
                  canReorderUp={idx > 0}
                  canReorderDown={idx < cards.length - 1}
                  assigneeName={
                    card.assigneeId ? (memberNameByUserId[card.assigneeId] ?? null) : null
                  }
                />
              ))
            )}
          </ul>
        </SortableContext>
      )}

      <CardComposer onSubmit={onAddCard} submitting={isAddingCard} />

      <ConfirmDialog
        open={confirmDelete}
        title="컬럼을 삭제할까요?"
        description={`"${column.name}" 컬럼과 안의 카드 ${cards.length}개가 영구 삭제돼요.`}
        confirmLabel="삭제"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteColumn?.();
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  );
};
