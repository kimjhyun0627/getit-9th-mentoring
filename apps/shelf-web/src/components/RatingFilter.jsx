import { cn } from '../lib/cn.js';

/**
 * 별점 2차 필터 (#199) — 최소 별점 0~5.
 *
 * - 0 = 전체 (필터 끔)
 * - 1~5 = 해당 별점 이상만 표시
 *
 * editorial 톤에 맞춰 작은 칩 5개 + "전체" 토글. 별점 매기지 않은 책은
 * minRating > 0 시 제외 — 사용자 의도(평가한 책 중에서 추리기)와 일치.
 *
 * @param {{ value: number; onChange: (next: number) => void; className?: string }} props
 */
export const RatingFilter = ({ value, onChange, className }) => {
  const options = [0, 1, 2, 3, 4, 5];
  return (
    <div
      role="group"
      aria-label="별점 필터"
      className={cn('flex items-center gap-1.5 text-[12px]', className)}
      data-testid="rating-filter"
    >
      <span className="smallcaps text-meta mr-1 text-[11px]">Rating</span>
      {options.map((n) => {
        const active = value === n;
        const label = n === 0 ? '전체' : `${n}점 이상`;
        return (
          <button
            key={n}
            type="button"
            aria-pressed={active}
            aria-label={`별점 필터 ${label}`}
            onClick={() => onChange(n)}
            className={cn(
              'rounded-sm border px-2 py-1 font-serif text-[11.5px] transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-foreground bg-foreground text-background'
                : 'border-rule-2 text-meta hover:border-foreground hover:text-ink',
            )}
          >
            {n === 0 ? '전체' : `${'★'.repeat(n)}+`}
          </button>
        );
      })}
    </div>
  );
};
