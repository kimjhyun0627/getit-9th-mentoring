import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { cn } from '../lib/cn.js';

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
    disabled: isTemp,
  });

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

/**
 * 드래그 핸들 — 카드 좌측의 작은 그립. listeners/attributes 만 부착해
 * 카드 본문 클릭 (편집 모달) 과 드래그를 분리한다 (#274).
 *
 * @param {{
 *   attributes: import('react').HTMLAttributes<HTMLButtonElement>;
 *   listeners: import('react').HTMLAttributes<HTMLButtonElement> | undefined;
 *   cardTitle: string;
 *   disabled?: boolean;
 * }} props
 */
const DragHandle = ({ attributes, listeners, cardTitle, disabled = false }) => (
  <button
    type="button"
    {...attributes}
    {...(disabled ? {} : listeners)}
    aria-label={`${cardTitle} 드래그하여 이동`}
    disabled={disabled}
    title={disabled ? '저장 중…' : '드래그해 이동'}
    className={cn(
      'flex h-5 w-3 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 transition hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
      disabled && 'cursor-not-allowed opacity-30',
    )}
  >
    <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.2" />
      <circle cx="15" cy="6" r="1.2" />
      <circle cx="9" cy="12" r="1.2" />
      <circle cx="15" cy="12" r="1.2" />
      <circle cx="9" cy="18" r="1.2" />
      <circle cx="15" cy="18" r="1.2" />
    </svg>
  </button>
);

/**
 * 같은 컬럼 안에서 위/아래로 1칸 이동하는 버튼 쌍 (#214).
 * 양 끝이면 disabled.
 *
 * @param {{
 *   cardTitle: string;
 *   onReorder: (direction: 'up' | 'down') => void;
 *   canUp: boolean;
 *   canDown: boolean;
 * }} props
 */
const ReorderButtons = ({ cardTitle, onReorder, canUp, canDown }) => (
  <div className="flex flex-col gap-px" role="group" aria-label={`${cardTitle} 순서 변경`}>
    <button
      type="button"
      onClick={() => onReorder('up')}
      disabled={!canUp}
      aria-label={`${cardTitle} 위로 이동`}
      className="inline-flex h-3 w-6 items-center justify-center rounded-sm border border-hairline text-[10px] text-muted-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        aria-hidden="true"
        className="h-2.5 w-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
    <button
      type="button"
      onClick={() => onReorder('down')}
      disabled={!canDown}
      aria-label={`${cardTitle} 아래로 이동`}
      className="inline-flex h-3 w-6 items-center justify-center rounded-sm border border-hairline text-[10px] text-muted-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg
        aria-hidden="true"
        className="h-2.5 w-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  </div>
);

/**
 * 카드 삭제 버튼 — 확인 없이 즉시 호출 (optimistic remove).
 *
 * @param {{ cardTitle: string; onDelete: () => void }} props
 */
const DeleteButton = ({ cardTitle, onDelete }) => (
  <button
    type="button"
    aria-label={`${cardTitle} 삭제`}
    onClick={onDelete}
    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-hairline text-muted-foreground transition hover:bg-foreground/[0.04] hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
  >
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  </button>
);
