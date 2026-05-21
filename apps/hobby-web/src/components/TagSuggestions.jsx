import { SUGGESTED_TAGS } from '../data/tags.js';
import { cn } from '../lib/cn.js';

/**
 * 모임 폼 태그 입력 보조 — 추천 태그 칩 8개.
 *
 * 클릭하면 `onPick(label)` 로 부모에 위임 (TagInput 이 정규식/중복/MAX 체크 후 추가).
 * 이미 선택된 태그는 disabled + 체크 표시 — UX 가 "이미 들어있음" 을 즉시 알려준다.
 *
 * @param {{
 *   value: string[];
 *   onPick: (label: string) => void;
 *   disabled?: boolean;
 *   labelledBy?: string;
 * }} props
 */
export const TagSuggestions = ({ value, onPick, disabled = false, labelledBy }) => {
  const selected = new Set(value.map((t) => t.toLowerCase()));

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : '추천 태그'}
      className="flex flex-wrap items-center gap-1.5"
    >
      {SUGGESTED_TAGS.map((s) => {
        // CR #365 nit: prop 계약이 `onPick(label)` 이므로 selected/onClick 모두 label 로 통일.
        // 현재 SUGGESTED_TAGS 는 key === label 이지만, 향후 분기되면 깨질 수 있어 미리 정렬.
        const picked = selected.has(s.label.toLowerCase());
        const isDisabled = disabled || picked;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.label)}
            disabled={isDisabled}
            aria-pressed={picked}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-round text-[12px] font-bold transition',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              picked
                ? 'bg-rose-100 text-rose-700 opacity-60 dark:bg-rose-500/20 dark:text-rose-200'
                : 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-rose-500/20 dark:hover:text-rose-200',
              isDisabled && !picked && 'cursor-not-allowed opacity-50',
              picked && 'cursor-not-allowed',
            )}
          >
            <span aria-hidden="true">{s.emoji}</span>
            {picked ? '✓' : '+'} {s.label}
          </button>
        );
      })}
    </div>
  );
};
