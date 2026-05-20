import { useTheme } from '@getit/theme';
import { useCallback, useId, useRef } from 'react';

import { cn } from '../lib/cn.js';

/**
 * @typedef {'light' | 'auto' | 'dark'} ThemeMode
 * @typedef {'light' | 'system' | 'dark'} ThemeStoreValue
 * @typedef {{ value: ThemeMode, label: string, storeValue: ThemeStoreValue }} ThemeOption
 */

/**
 * 컴포넌트 외부 상수 — props/state 와 무관하므로 매 렌더링마다 재생성될 필요 X.
 *
 * @type {ThemeOption[]}
 */
const OPTIONS = [
  { value: 'light', label: 'Light', storeValue: 'light' },
  { value: 'auto', label: 'Auto', storeValue: 'system' },
  { value: 'dark', label: 'Dark', storeValue: 'dark' },
];

/**
 * Light / Auto / Dark 3-state 세그먼티드 토글.
 * 시안: `docs/design/board/toggle.html` B안. Minimalist 페르소나 — 1px 보더, 8px grid,
 * 200ms cubic-bezier transition, 아이콘 없이 텍스트.
 *
 * 공용 store의 preference 값은 `'light' | 'dark' | 'system'` 이지만 UX 라벨은 "Auto" 로 표기.
 * 본 컴포넌트는 store 의 `'system'` 을 UI 의 `'auto'` 로 매핑.
 *
 * a11y (WAI-ARIA Radio Group APG):
 * - `role="radiogroup"` + `aria-label`
 * - 각 옵션 `role="radio"` + `aria-checked`
 * - Roving tabindex: 선택된 옵션만 `tabIndex=0`, 나머지 `-1`
 * - 키보드 ←/→/↑/↓/Home/End — **focus 이동 + 자동 선택** (APG automatic activation)
 * - `prefers-reduced-motion: reduce` 일 때 transition 제거 (motion-reduce:transition-none)
 *
 * @param {{ className?: string }} props
 */
export const ThemeSegmented = ({ className }) => {
  const preference = useTheme((s) => s.preference);
  const setPreference = useTheme((s) => s.setPreference);

  // store ⇄ UI 매핑. store: 'system' / UI: 'auto'.
  const mode = preference === 'system' ? 'auto' : preference;

  const groupId = useId();
  /** @type {import('react').MutableRefObject<(HTMLButtonElement | null)[]>} */
  const buttonsRef = useRef([]);

  /**
   * focus + 선택을 같이 적용 (WAI-ARIA Radio Group 자동 활성화 패턴).
   *
   * @param {number} i 대상 인덱스 (wrap-around)
   */
  const selectAndFocus = useCallback(
    (i) => {
      const next = (i + OPTIONS.length) % OPTIONS.length;
      const opt = OPTIONS[next];
      setPreference(opt.storeValue);
      // setPreference 후 렌더링이 끝나기 전이라도 ref는 안정.
      const el = buttonsRef.current[next];
      if (el) el.focus();
    },
    [setPreference],
  );

  const onKeyDown = useCallback(
    (e, idx) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          selectAndFocus(idx + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          selectAndFocus(idx - 1);
          break;
        case 'Home':
          e.preventDefault();
          selectAndFocus(0);
          break;
        case 'End':
          e.preventDefault();
          selectAndFocus(OPTIONS.length - 1);
          break;
        default:
          break;
      }
    },
    [selectAndFocus],
  );

  return (
    <div
      role="radiogroup"
      aria-label="테마 모드"
      id={groupId}
      data-mode={mode}
      className={cn(
        // 컨테이너: inline-grid 3-col → 각 셀이 정확히 1/3 너비.
        // indicator(w-1/3) 위치와 어긋나지 않음.
        'relative inline-grid grid-cols-3 items-center rounded-md border border-hairline p-0.5',
        'bg-zinc-50 dark:bg-zinc-900',
        'text-xs font-medium',
        className,
      )}
    >
      {/* indicator: 선택된 옵션 위에 떠 있는 흰색(다크 시 zinc-950) 박스. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0.5 left-0.5 rounded-[4px]',
          'w-[calc((100%-0.25rem)/3)]',
          'bg-white dark:bg-zinc-950',
          'shadow-[0_1px_2px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)]',
          'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)]',
          'transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
          'motion-reduce:transition-none',
          mode === 'light' && 'translate-x-0',
          mode === 'auto' && 'translate-x-full',
          mode === 'dark' && 'translate-x-[200%]',
        )}
      />
      {OPTIONS.map((opt, idx) => {
        const checked = mode === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonsRef.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-val={opt.value}
            onClick={() => setPreference(opt.storeValue)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              // segmented item: 평면. 아이콘 없이 라벨만.
              'relative z-[1] cursor-pointer rounded-[4px] px-4 py-1.5',
              'transition-colors duration-150',
              'motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              checked
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
