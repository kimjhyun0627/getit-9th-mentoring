import { cn } from '../lib/cn.js';

/**
 * 페이지네이션 (#269) — 100건 넘는 서재 처리.
 *
 * - 첫 페이지 / 끝 페이지 / 인접 ±1 만 노출 (1 … 4 5 6 … 12 형태)
 * - 화살표는 단방향만 (boundary 에서 disabled)
 * - 현재 페이지는 aria-current=page
 *
 * @param {{
 *   page: number;
 *   totalPages: number;
 *   onChange: (next: number) => void;
 *   className?: string;
 * }} props
 */
export const Pagination = ({ page, totalPages, onChange, className }) => {
  if (totalPages <= 1) return null;
  const slots = computeSlots(page, totalPages);

  const goto = (next) => {
    if (next < 1 || next > totalPages || next === page) return;
    onChange(next);
  };

  return (
    <nav
      aria-label="서재 페이지"
      // #480 — 좁은 폰 (≤ 480px) 에서 한 줄에 안 들어갈 때 한 행 wrap.
      //         computeSlots 가 이미 1…?…last 로 축약 하지만, 토큰 자체가 7-9 개라
      //         320px 폭에서는 ›/‹ 버튼이 잘림. flex-wrap 으로 가로 스크롤 대신 줄바꿈.
      className={cn(
        'flex flex-wrap items-center justify-center gap-1.5 font-serif text-[13px] sm:gap-2',
        className,
      )}
      data-testid="shelf-pagination"
    >
      <button
        type="button"
        onClick={() => goto(page - 1)}
        disabled={page === 1}
        aria-label="이전 페이지"
        className="rounded-sm border border-rule-2 px-2 py-1 text-meta transition hover:border-foreground hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      {slots.map((slot, idx) =>
        slot === '…' ? (
          <span
            key={`gap-${idx}`}
            aria-hidden="true"
            className="num-display px-1 text-hint select-none"
          >
            …
          </span>
        ) : (
          <button
            key={slot}
            type="button"
            onClick={() => goto(slot)}
            aria-current={slot === page ? 'page' : undefined}
            className={cn(
              'num-display min-w-[2.25rem] rounded-sm border px-2 py-1 transition',
              slot === page
                ? 'border-foreground bg-foreground text-background'
                : 'border-rule-2 text-meta hover:border-foreground hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper-1)]',
            )}
          >
            {slot}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => goto(page + 1)}
        disabled={page === totalPages}
        aria-label="다음 페이지"
        className="rounded-sm border border-rule-2 px-2 py-1 text-meta transition hover:border-foreground hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
    </nav>
  );
};

/**
 * 페이지 슬롯 계산 — 항상 1 과 totalPages 를 포함하고 현재 페이지 주변 ±1 노출.
 * 현재가 양 끝(1 또는 last)일 땐 반대 방향 ±2 까지 보여줘 좁은 슬롯을 채운다.
 * 양 끝 사이 갭은 '…' 문자열로 표기.
 *
 * 예:
 *   - page=6 / total=12 → [1, '…', 5, 6, 7, '…', 12]
 *   - page=1 / total=5  → [1, 2, 3, '…', 5]
 *   - page=5 / total=5  → [1, '…', 3, 4, 5]
 *
 * @param {number} page
 * @param {number} totalPages
 * @returns {(number | '…')[]}
 */
const computeSlots = (page, totalPages) => {
  const slots = new Set([1, totalPages, page, page - 1, page + 1]);
  // 양 끝에 붙어 있으면 반대 방향으로 한 칸 더 확장.
  if (page === 1) slots.add(page + 2);
  if (page === totalPages) slots.add(page - 2);
  const sorted = [...slots].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  /** @type {(number | '…')[]} */
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…');
    out.push(sorted[i]);
  }
  return out;
};
