import { cn } from '../lib/cn.js';

/**
 * KanbanCard 내부 sub-component 모음 (#420 #424).
 *
 * - DragHandle: 좌측 그립 — listeners/attributes 만 부착해 카드 본문 클릭(편집)과 분리.
 * - ReorderButtons: 같은 컬럼 1칸 위/아래 이동. 모바일에선 hidden + DnD/MoveMenu 로 대체.
 * - DeleteButton: 카드 삭제 (확인 다이얼로그는 부모가 띄움).
 *
 * KanbanCard.jsx 가 300줄 룰 넘지 않도록 분리. 외부 노출은 KanbanCard 만 — 이 파일은 내부용.
 */

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
export const DragHandle = ({ attributes, listeners, cardTitle, disabled = false }) => (
  <button
    type="button"
    {...attributes}
    {...(disabled ? {} : listeners)}
    aria-label={`${cardTitle} 드래그하여 이동`}
    disabled={disabled}
    title={disabled ? '저장 중…' : '드래그해 이동'}
    data-testid="drag-handle"
    className={cn(
      // #424: idle 상태에서도 muted-foreground 풀톤으로 affordance 향상.
      // 신규 유저가 grip 을 인지할 수 있도록 hover/focus 시 indigo accent 로 강조.
      'flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded-sm text-muted-foreground transition hover:bg-foreground/[0.04] hover:text-indigo-accent active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
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
 * #420: 모바일에서는 hidden — 우측 액션 밀집 + 12px 터치 타깃 WCAG 미달 회피.
 *
 * @param {{
 *   cardTitle: string;
 *   onReorder: (direction: 'up' | 'down') => void;
 *   canUp: boolean;
 *   canDown: boolean;
 * }} props
 */
export const ReorderButtons = ({ cardTitle, onReorder, canUp, canDown }) => (
  <div
    className="hidden flex-col gap-px sm:flex"
    role="group"
    aria-label={`${cardTitle} 순서 변경`}
    data-testid="reorder-buttons"
  >
    <button
      type="button"
      onClick={() => onReorder('up')}
      disabled={!canUp}
      aria-label={`${cardTitle} 위로 이동`}
      className="inline-flex h-4 w-6 items-center justify-center rounded-sm border border-hairline text-[10px] text-muted-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
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
      className="inline-flex h-4 w-6 items-center justify-center rounded-sm border border-hairline text-[10px] text-muted-foreground transition hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
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
 * 카드 삭제 버튼 — 부모가 ConfirmDialog 로 확인 흐름 처리.
 *
 * @param {{ cardTitle: string; onDelete: () => void }} props
 */
export const DeleteButton = ({ cardTitle, onDelete }) => (
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
