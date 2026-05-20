import { cn } from '../lib/cn.js';

import { CardComposer } from './CardComposer.jsx';
import { KanbanCard } from './KanbanCard.jsx';

/**
 * 보드 컬럼 1개 — 헤더 + 카드 리스트 + 인라인 컴포저.
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
 *   isAddingCard?: boolean;
 *   isLoading?: boolean;
 * }} props
 */
export const BoardColumn = ({
  column,
  cards,
  otherColumns,
  onAddCard,
  onMoveCard,
  onDeleteCard,
  isAddingCard = false,
  isLoading = false,
}) => {
  const accent = columnAccent(column.name);
  return (
    <section aria-label={`${column.name} 컬럼`} className="flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', accent)} />
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/80">
            {column.name}
          </h2>
          <span className="font-mono text-[11px] text-muted-foreground">· {cards.length}</span>
        </div>
      </header>

      {isLoading ? (
        <div className="px-5 py-6" role="status" aria-label={`${column.name} 카드 불러오는 중`}>
          {['a', 'b'].map((slot) => (
            <div key={slot} className="mb-2 h-12 animate-pulse rounded-md bg-foreground/[0.04]" />
          ))}
        </div>
      ) : (
        <ul className="card-stack flex flex-col">
          {cards.length === 0 ? (
            <li className="px-5 py-6 text-center text-[11px] text-muted-foreground">
              카드 없음 — 아래에서 추가
            </li>
          ) : (
            cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                columnName={column.name}
                otherColumns={otherColumns}
                onMove={(targetColumnId) => onMoveCard(card.id, targetColumnId)}
                onDelete={() => onDeleteCard(card.id)}
              />
            ))
          )}
        </ul>
      )}

      <CardComposer onSubmit={onAddCard} submitting={isAddingCard} />
    </section>
  );
};

/**
 * 컬럼 이름별 헤더 도트 컬러.
 *
 * @param {string} name
 */
const columnAccent = (name) => {
  if (name === 'Doing') return 'bg-indigo-accent';
  if (name === 'Done') return 'bg-foreground';
  return 'bg-muted-foreground/60';
};
