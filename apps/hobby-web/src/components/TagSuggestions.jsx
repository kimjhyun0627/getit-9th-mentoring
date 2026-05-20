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
        const picked = selected.has(s.key.toLowerCase());
        const isDisabled = disabled || picked;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s.key)}
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
