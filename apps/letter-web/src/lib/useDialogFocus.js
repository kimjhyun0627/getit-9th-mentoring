/**
 * 모달 dialog 의 포커스 관리 hook — WAI-ARIA dialog 패턴.
 *
 * - 모달 open 시 `initialSelector` 로 초기 포커스 (없으면 첫 focusable).
 * - Tab / Shift+Tab 으로 dialog 내부에서만 포커스 순환.
 * - 닫힐 때 이전 포커스 복원.
 *
 * ComposeModal / EditModal 공통 책임. 두 군데에서 거의 동일한 코드를
 * 중복으로 들고있어 hook 으로 분리 (라인 수 + DRY).
 *
 * @param {{
 *   open: boolean,
 *   ref: import('react').MutableRefObject<HTMLElement | null>,
 *   initialSelector?: string,
 * }} opts
 */
import { useEffect } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const useDialogFocus = ({ open, ref, initialSelector }) => {
  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = /** @type {HTMLElement | null} */ (document.activeElement);

    const getFocusable = () => {
      const el = ref.current;
      if (!el) return /** @type {HTMLElement[]} */ ([]);
      return /** @type {HTMLElement[]} */ (Array.from(el.querySelectorAll(FOCUSABLE)));
    };

    const initial = initialSelector
      ? /** @type {HTMLElement | null} */ (
          ref.current?.querySelector(initialSelector) ?? getFocusable()[0]
        )
      : getFocusable()[0];
    initial?.focus();

    /** @param {KeyboardEvent} e */
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !ref.current?.contains(/** @type {Node} */ (active))) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [open, ref, initialSelector]);
};
