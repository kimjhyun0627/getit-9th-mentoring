import { BoardColumn } from './BoardColumn.jsx';
import { BoardDndContext } from './BoardDndContext.jsx';
import { NewColumnComposer } from './NewColumnComposer.jsx';

/**
 * 칸반 그리드 — 컬럼 N개 + 새 컬럼 컴포저.
 *
 * #223: 모바일 가로 스크롤 (snap).
 * #356: 데스크탑도 가로 스크롤로 통일 (칸반 표준). 컬럼이 늘어나도 wrap 안 됨.
 * #381: 가로 스크롤바 항상 표시 + Minimalist 톤 (neutral gray thumb, hover 강조).
 *        모바일은 .board-grid-scroll 매체 쿼리로 native swipe 유지 (스크롤바 숨김).
 *
 * @param {{
 *   columns: Array<{ id: string; name: string; order: number }>;
 *   cardsByColumn: Record<string, Array<any>>;
 *   addingColumnId: string | null;
 *   isAddingCardPending: boolean;
 *   isBoardLoading: boolean;
 *   memberNameByUserId: Record<string, string | null>;
 *   onAddCard: (columnId: string, title: string) => void;
 *   onMoveCard: (cardId: string, sourceColumnId: string, targetColumnId: string, order?: number) => void;
 *   onDeleteCard: (cardId: string, columnId: string) => void;
 *   onEditCard: (cardId: string) => void;
 *   onReorderCard: (cardId: string, direction: 'up' | 'down') => void;
 *   onCreateColumn: (name: string) => void;
 *   onRenameColumn: (columnId: string, name: string) => void;
 *   onDeleteColumn: (columnId: string) => void;
 *   isCreateColumnPending: boolean;
 * }} props
 */
export const BoardGrid = ({
  columns,
  cardsByColumn,
  addingColumnId,
  isAddingCardPending,
  isBoardLoading,
  memberNameByUserId,
  onAddCard,
  onMoveCard,
  onDeleteCard,
  onEditCard,
  onReorderCard,
  onCreateColumn,
  onRenameColumn,
  onDeleteColumn,
  isCreateColumnPending,
}) => (
  <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
    <BoardDndContext
      columns={columns}
      cardsByColumn={cardsByColumn}
      onMoveCard={(cardId, sourceColumnId, targetColumnId, order) =>
        onMoveCard(cardId, sourceColumnId, targetColumnId, order)
      }
    >
      <div
        data-testid="board-grid"
        className="board-grid-scroll flex w-full flex-nowrap snap-x snap-mandatory gap-px rounded-lg border border-hairline bg-hairline md:snap-none"
      >
        {columns.map((col) => (
          <div
            key={col.id}
            className="w-[85vw] min-w-[16rem] shrink-0 snap-start md:w-72 md:min-w-[18rem]"
          >
            <BoardColumn
              column={col}
              cards={cardsByColumn[col.id] ?? []}
              otherColumns={columns.filter((c) => c.id !== col.id)}
              onAddCard={(title) => onAddCard(col.id, title)}
              onMoveCard={(cardId, targetColumnId) => onMoveCard(cardId, col.id, targetColumnId)}
              onDeleteCard={(cardId) => onDeleteCard(cardId, col.id)}
              onEditCard={onEditCard}
              onReorderCard={onReorderCard}
              memberNameByUserId={memberNameByUserId}
              isAddingCard={addingColumnId === col.id && isAddingCardPending}
              isLoading={isBoardLoading && (cardsByColumn[col.id] ?? []).length === 0}
              onRenameColumn={(name) => onRenameColumn(col.id, name)}
              onDeleteColumn={() => onDeleteColumn(col.id)}
              canDeleteColumn={columns.length > 1}
            />
          </div>
        ))}
        <div className="w-[85vw] min-w-[16rem] shrink-0 snap-start md:w-72 md:min-w-[18rem]">
          <NewColumnComposer onSubmit={onCreateColumn} submitting={isCreateColumnPending} />
        </div>
      </div>
    </BoardDndContext>
  </section>
);
