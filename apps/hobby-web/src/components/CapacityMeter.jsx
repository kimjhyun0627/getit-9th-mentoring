import { cn } from '../lib/cn.js';

/**
 * 정원 시각화 — playful 톤. ●●○○ 같은 dot row.
 * - filled = currentCapacity, empty = capacity - currentCapacity
 * - capacity 가 크면 (>12) compact mode 로 progress bar 로 폴백.
 *
 * @param {{
 *   currentCapacity: number;
 *   capacity: number;
 *   tone?: 'light' | 'dark';
 * }} props
 */
export const CapacityMeter = ({ currentCapacity, capacity, tone = 'light' }) => {
  const filled = Math.max(0, Math.min(currentCapacity, capacity));
  const empty = Math.max(0, capacity - filled);
  const compact = capacity > 12;

  return (
    <div
      data-testid="capacity-meter"
      role="meter"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={capacity}
      aria-label={`정원 ${filled}/${capacity}`}
      className="inline-flex items-center gap-3"
    >
      {compact ? (
        <div className="h-3 w-44 rounded-full bg-white/40 dark:bg-white/10 overflow-hidden">
          <div
            data-filled="true"
            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500"
            style={{ width: `${capacity === 0 ? 0 : (filled / capacity) * 100}%` }}
          />
        </div>
      ) : (
        <ul className="inline-flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: filled }).map((_, i) => (
            <li
              key={`f-${i}`}
              data-filled="true"
              className={cn(
                'h-3.5 w-3.5 rounded-full shadow-sm',
                tone === 'dark' ? 'bg-amber-300' : 'bg-gradient-to-br from-rose-400 to-fuchsia-500',
              )}
            />
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <li
              key={`e-${i}`}
              data-filled="false"
              className={cn(
                'h-3.5 w-3.5 rounded-full ring-2',
                tone === 'dark'
                  ? 'ring-white/30 bg-transparent'
                  : 'ring-slate-300 dark:ring-white/20 bg-transparent',
              )}
            />
          ))}
        </ul>
      )}
      <span className="font-display font-extrabold text-base text-slate-800 dark:text-slate-100">
        {filled}
        <span className="opacity-50">/{capacity}</span>
      </span>
    </div>
  );
};
