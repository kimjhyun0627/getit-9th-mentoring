import { useId } from 'react';

import { cn } from '../lib/cn.js';

/**
 * 포스트잇 색상 4종. Warm 시안의 light/dark 팔레트를 그대로 매핑.
 *
 * @type {Array<{
 *   value: 'PINK' | 'MINT' | 'LEMON' | 'LAVENDER';
 *   label: string;
 *   light: string;
 *   dark: string;
 * }>}
 */
export const STICKY_COLORS = Object.freeze([
  { value: 'PINK', label: 'PINK', light: '#FBD6DC', dark: '#E8B7BF' },
  { value: 'MINT', label: 'MINT', light: '#CFE5D3', dark: '#B5D2BA' },
  { value: 'LEMON', label: 'LEMON', light: '#FBE9B7', dark: '#E8D29A' },
  { value: 'LAVENDER', label: 'LAVENDER', light: '#E0D2EE', dark: '#C9B8DC' },
]);

/**
 * 4색 라디오 그룹 (포스트잇 스와치) — ComposeModal 전용.
 *
 * 접근성:
 *  - `<fieldset>` + `<legend>` 로 그룹 라벨 (스크린리더)
 *  - `role=radio` + `aria-checked` 로 각 스와치
 *  - 에러 메시지는 `aria-describedby` 로 연결
 *
 * @param {{
 *   value: 'PINK' | 'MINT' | 'LEMON' | 'LAVENDER' | undefined;
 *   onChange: (v: string) => void;
 *   error?: string;
 *   errorId?: string;
 * }} props
 */
export const ColorPicker = ({ value, onChange, error, errorId }) => {
  const groupLabelId = useId();
  return (
    <fieldset
      aria-labelledby={groupLabelId}
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2"
    >
      <legend id={groupLabelId} className="font-hand text-base text-ink dark:text-beige">
        포스트잇 색
      </legend>
      <div role="radiogroup" aria-labelledby={groupLabelId} className="flex flex-wrap gap-3">
        {STICKY_COLORS.map((c) => {
          const selected = value === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              onClick={() => onChange(c.value)}
              style={{ backgroundColor: c.light }}
              className={cn(
                'group relative h-14 w-14 rounded-lg shadow-md transition',
                'hover:-translate-y-0.5 hover:shadow-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-peachDk focus-visible:ring-offset-2 focus-visible:ring-offset-cream',
                'dark:focus-visible:ring-rose dark:focus-visible:ring-offset-mocha2',
                selected &&
                  'ring-2 ring-ink ring-offset-2 ring-offset-cream dark:ring-beige dark:ring-offset-mocha2',
              )}
            >
              <span className="sr-only">{c.label}</span>
              {selected ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 grid place-items-center font-pen text-2xl text-ink"
                >
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-red-600 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};
