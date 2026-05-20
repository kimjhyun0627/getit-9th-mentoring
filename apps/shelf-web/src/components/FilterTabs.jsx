import { cn } from '../lib/cn.js';

/**
 * 서재 필터 탭 — All / Read / Reading / Wishlist.
 * spec status: 'ALL' | 'WANT' | 'READING' | 'READ'.
 *
 * @typedef {'ALL' | 'WANT' | 'READING' | 'READ'} FilterKey
 *
 * @param {{
 *   active: FilterKey;
 *   onChange: (next: FilterKey) => void;
 *   counts: Record<FilterKey, number>;
 *   className?: string;
 * }} props
 */
export const FilterTabs = ({ active, onChange, counts, className }) => {
  /** @type {{ key: FilterKey; label: string; ko: string }[]} */
  const tabs = [
    { key: 'ALL', label: 'All', ko: '전체' },
    { key: 'READ', label: 'Read', ko: '읽은 책' },
    { key: 'READING', label: 'Reading', ko: '읽는 중' },
    { key: 'WANT', label: 'Wishlist', ko: '읽고 싶은 책' },
  ];

  return (
    <div
      className={cn('flex items-center gap-5 text-[12px]', className)}
      role="group"
      aria-label="서재 필터"
    >
      {tabs.map(({ key, label, ko }) => {
        const isActive = active === key;
        const count = counts[key] ?? 0;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            aria-label={`${label} · ${ko} 보기`}
            className={cn('filter-btn smallcaps', isActive && 'is-active')}
            onClick={() => onChange(key)}
          >
            {label}
            {count > 0 ? <span className="num-display ml-2">· {count}</span> : null}
          </button>
        );
      })}
    </div>
  );
};
