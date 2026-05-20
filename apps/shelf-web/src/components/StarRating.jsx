import { cn } from '../lib/cn.js';

const MAX = 5;

/**
 * 별점 표시 / 입력 — editorial wine 톤.
 * - readonly: 시각적 별점만. aria-label에 점수.
 * - interactive: 0 ~ 5 사이 정수 클릭 가능. value=0 = 별점 없음.
 *
 * @typedef {object} StarRatingProps
 * @property {number | null} value 현재 점수 (0~5, null 가능)
 * @property {(n: number) => void} [onChange] interactive 모드일 때 점수 변경 콜백
 * @property {boolean} [readonly=false] 표시 전용 모드
 * @property {string} [className] 추가 클래스
 * @property {string} [ariaLabel] 라벨 (기본은 "별점 N점" 자동 생성)
 *
 * @param {StarRatingProps} props
 */
export const StarRating = ({ value, onChange, readonly = false, className, ariaLabel }) => {
  const safe = typeof value === 'number' && value >= 0 ? Math.min(value, MAX) : 0;
  const label = ariaLabel ?? (safe > 0 ? `별점 ${safe}점` : '별점 없음');

  if (readonly) {
    return (
      <span className={cn('stars-row text-[12.5px]', className)} aria-label={label} role="img">
        {Array.from({ length: MAX }).map((_, i) => (
          <span key={i} className={i < safe ? '' : 'dim'} aria-hidden="true">
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <div
      className={cn('stars-row flex items-center gap-1 text-base', className)}
      role="radiogroup"
      aria-label={ariaLabel ?? '별점 선택'}
    >
      {Array.from({ length: MAX }).map((_, i) => {
        const score = i + 1;
        const filled = score <= safe;
        return (
          <button
            key={score}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={`별점 ${score}점`}
            onClick={() => onChange?.(score)}
            className={cn(
              'cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              filled ? '' : 'opacity-25 hover:opacity-60',
            )}
          >
            ★
          </button>
        );
      })}
      {safe > 0 && onChange ? (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-meta ml-2 text-[11px] underline-offset-2 hover:underline"
          aria-label="별점 지우기"
        >
          지우기
        </button>
      ) : null}
    </div>
  );
};
