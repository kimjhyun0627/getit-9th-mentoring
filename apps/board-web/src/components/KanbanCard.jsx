import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '../lib/cn.js';

import { DeleteButton, DragHandle, ReorderButtons } from './KanbanCardParts.jsx';
import { MemberAvatar } from './MemberAvatar.jsx';
import { MoveMenu } from './MoveMenu.jsx';

/**
 * 단일 칸반 카드.
 * - Doing 컬럼: 좌측 인디고 인디케이터 (`data-testid="doing-indicator"`)
 * - Done 컬럼: 제목 line-through + 흐리게
 * - 본문(제목/설명) 클릭 → 편집 모달 오픈 (#198)
 * - 우측 액션: 위/아래 reorder (#214) + 이동 드롭다운 + 삭제
 *
 * @param {{
 *   card: {
 *     id: string;
 *     columnId: string;
 *     title: string;
 *     description?: string | null;
 *     assigneeId?: string | null;
 *   };
 *   columnName: 'Todo' | 'Doing' | 'Done' | string;
 *   otherColumns: Array<{ id: string; name: string }>;
 *   onMove: (targetColumnId: string) => void;
 *   onDelete: () => void;
 *   onEdit?: () => void;
 *   onReorder?: (direction: 'up' | 'down') => void;
 *   canReorderUp?: boolean;
 *   canReorderDown?: boolean;
 *   assigneeName?: string | null;
 * }} props
 */
export const KanbanCard = ({
  card,
  columnName,
  otherColumns,
  onMove,
  onDelete,
  onEdit,
  onReorder,
  canReorderUp = false,
  canReorderDown = false,
  assigneeName = null,
}) => {
  const isDoing = columnName === 'Doing';
  const isDone = columnName === 'Done';

  // #274: sortable wiring. temp- 카드 (optimistic) 는 drag disabled —
  // 서버 id 없는 상태에서 drop 하면 mutation 가 잘못된 id 로 호출됨.
  const isTemp = typeof card.id === 'string' && card.id.startsWith('temp-');
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    over,
    active,
  } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
    disabled: isTemp,
  });

  // #422: drop indicator — 이 카드가 over 대상일 때 active 의 원래 위치에 따라
  // 위/아래 어느 쪽에 라인을 그릴지 결정한다. dnd-kit 의 SortableContext rect 인덱스 비교.
  // active.data.current.sortable.index < over.data.current.sortable.index 이면 active 가 위에서 내려옴 → 라인은 카드 아래.
  // 반대면 라인은 카드 위.
  const showDropAbove =
    isOver &&
    !isDragging &&
    active?.data?.current?.sortable?.index !== undefined &&
    over?.data?.current?.sortable?.index !== undefined &&
    active.data.current.sortable.index > over.data.current.sortable.index;
  const showDropBelow =
    isOver &&
    !isDragging &&
    active?.data?.current?.sortable?.index !== undefined &&
    over?.data?.current?.sortable?.index !== undefined &&
    active.data.current.sortable.index < over.data.current.sortable.index;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'kanban-card group relative block px-5 py-4 transition hover:bg-foreground/[0.03]',
        isDragging && 'z-10',
      )}
    >
      {showDropAbove ? (
        <span
          aria-hidden="true"
          data-testid="drop-indicator-above"
          className="pointer-events-none absolute left-3 right-3 top-0 h-0.5 -translate-y-0.5 rounded-full bg-indigo-accent"
        />
      ) : null}
      {showDropBelow ? (
        <span
          aria-hidden="true"
          data-testid="drop-indicator-below"
          className="pointer-events-none absolute bottom-0 left-3 right-3 h-0.5 translate-y-0.5 rounded-full bg-indigo-accent"
        />
      ) : null}
      {isDoing ? (
        <span
          aria-hidden="true"
          data-testid="doing-indicator"
          className="absolute bottom-4 left-0 top-4 w-px bg-indigo-accent"
        />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <DragHandle
          attributes={attributes}
          listeners={listeners}
          cardTitle={card.title}
          disabled={isTemp}
        />
        <button
          type="button"
          onClick={onEdit}
          disabled={!onEdit}
          aria-label={`${card.title} 편집`}
          className={cn(
            'min-w-0 flex-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            !onEdit && 'cursor-default',
          )}
        >
          <h3
            className={cn(
              'truncate text-sm font-medium',
              isDone
                ? 'text-muted-foreground line-through decoration-zinc-300 dark:decoration-zinc-700'
                : 'text-foreground',
            )}
          >
            {card.title}
          </h3>
          {card.description ? (
            <p
              className={cn(
                'mt-1 line-clamp-1 text-xs leading-relaxed',
                isDone ? 'text-muted-foreground/70' : 'text-muted-foreground',
              )}
            >
              {card.description}
            </p>
          ) : null}
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {card.assigneeId ? (
            <MemberAvatar size="sm" userId={card.assigneeId} name={assigneeName} />
          ) : null}
          {onReorder ? (
            <ReorderButtons
              cardTitle={card.title}
              onReorder={onReorder}
              canUp={canReorderUp}
              canDown={canReorderDown}
            />
          ) : null}
          <MoveMenu cardTitle={card.title} otherColumns={otherColumns} onMove={onMove} />
          <DeleteButton cardTitle={card.title} onDelete={onDelete} />
        </div>
      </div>
    </li>
  );
};
