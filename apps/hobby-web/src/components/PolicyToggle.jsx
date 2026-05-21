import { cn } from '../lib/cn.js';

/**
 * 신청 정책 토글 — FIRST_COME / APPROVAL (#504).
 *
 * 카피 결정 (Playful 톤):
 *  - FIRST_COME: '선착순' + '자유롭게, 빠르게.'
 *  - APPROVAL: '승인 게이트' + '방장이 한 번 확인해.'
 *
 * a11y: role="radiogroup" + role="radio" + aria-checked. 키보드는 네이티브 라디오로.
 * 기본값 FIRST_COME (backward-compat). value 가 null/undefined 면 FIRST_COME 으로 그림.
 *
 * @param {{
 *   value: 'FIRST_COME' | 'APPROVAL';
 *   onChange: (next: 'FIRST_COME' | 'APPROVAL') => void;
 *   disabled?: boolean;
 *   label?: string;
 * }} props
 */
export const PolicyToggle = ({ value, onChange, disabled = false, label = '신청 정책' }) => {
  const current = value ?? 'FIRST_COME';
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      role="radiogroup"
      aria-label={label}
      disabled={disabled || undefined}
    >
      <legend className="font-round text-sm font-bold text-slate-800 dark:text-slate-100">
        {label}
      </legend>
      <p className="text-xs text-slate-500 dark:text-slate-400 font-round">
        나중에 신청자가 한 명이라도 생기면 변경 불가야.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PolicyOption
          name="applicationPolicy"
          value="FIRST_COME"
          current={current}
          onChange={onChange}
          disabled={disabled}
          title="선착순"
          emoji="⚡"
          description="자유롭게, 빠르게. 정원 차면 자동 마감."
        />
        <PolicyOption
          name="applicationPolicy"
          value="APPROVAL"
          current={current}
          onChange={onChange}
          disabled={disabled}
          title="승인 게이트"
          emoji="✋"
          description="방장이 한 번 확인. 승인하면 합류 확정."
        />
      </div>
    </fieldset>
  );
};

/**
 * @param {{
 *   name: string;
 *   value: 'FIRST_COME' | 'APPROVAL';
 *   current: 'FIRST_COME' | 'APPROVAL';
 *   onChange: (next: 'FIRST_COME' | 'APPROVAL') => void;
 *   disabled: boolean;
 *   title: string;
 *   emoji: string;
 *   description: string;
 * }} props
 */
const PolicyOption = ({ name, value, current, onChange, disabled, title, emoji, description }) => {
  const active = current === value;
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer flex-col gap-1 rounded-2xl border px-4 py-3 transition',
        active
          ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-400 dark:border-rose-300 dark:bg-rose-500/10'
          : 'border-slate-200 bg-white hover:border-rose-300 dark:border-white/10 dark:bg-white/[0.04]',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={active}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="sr-only"
        aria-checked={active}
      />
      <span className="font-display text-sm font-extrabold text-slate-900 dark:text-white">
        <span aria-hidden="true" className="mr-1">
          {emoji}
        </span>
        {title}
      </span>
      <span className="font-round text-xs text-slate-600 dark:text-slate-300">{description}</span>
    </label>
  );
};
