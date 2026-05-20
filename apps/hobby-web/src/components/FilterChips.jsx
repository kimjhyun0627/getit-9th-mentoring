import { TAG_CHIPS, TIME_CHIPS } from '../data/tags.js';
import { cn } from '../lib/cn.js';

/**
 * 필터 칩 — 시간 (전체/오늘/이번주) + 태그 (단일 선택).
 * 시안의 chip-pop 호버 + selected 인버스 토큰.
 *
 * @param {{
 *   timeKey: 'all' | 'today' | 'week';
 *   onTimeChange: (k: 'all' | 'today' | 'week') => void;
 *   tagKey: string | null;
 *   onTagChange: (k: string | null) => void;
 * }} props
 */
export const FilterChips = ({ timeKey, onTimeChange, tagKey, onTagChange }) => {
  return (
    <div className="mt-9 flex flex-wrap items-center gap-2.5" role="tablist" aria-label="필터">
      {TIME_CHIPS.map((c) => {
        const active = timeKey === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTimeChange(c.key)}
            className={cn(
              'chip-pop inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-round font-bold shadow-sm',
              active
                ? 'bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 shadow-md'
                : 'bg-white dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/10 text-slate-700 dark:text-slate-200',
            )}
          >
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </button>
        );
      })}
      <span
        aria-hidden="true"
        className="mx-1 hidden sm:inline-block h-5 w-px bg-slate-300/70 dark:bg-white/10"
      />
      {TAG_CHIPS.map((c) => {
        const active = tagKey === c.label;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={active}
            onClick={() => onTagChange(active ? null : c.label)}
            className={cn(
              'chip-pop inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-round font-bold',
              active
                ? 'bg-slate-900 dark:bg-amber-300 text-white dark:text-slate-900 shadow-md'
                : c.tone,
            )}
          >
            #{c.label}
          </button>
        );
      })}
    </div>
  );
};
