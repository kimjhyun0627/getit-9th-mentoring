import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * @typedef {{ id: number, message: string, variant: 'success' | 'error', count: number }} ToastItem
 */

/**
 * 다중 토스트 큐 관리 hook (#294).
 *
 * push 호출 시:
 *  - 직전 toast 와 메시지·variant 가 동일하면 count++ 만 증가 (깜빡임 방지)
 *  - 다르면 새 토스트 push. 동시 표시 상한 = `max` (기본 3).
 *
 * 각 토스트는 `duration` 후 자동 dismiss. 사용자 dismiss 도 가능.
 * `ToastStack` 컴포넌트와 함께 사용한다.
 *
 * @param {{ max?: number, duration?: number }} [opts]
 */
export const useToastQueue = ({ max = 3, duration = 2400 } = {}) => {
  /** @type {[ToastItem[], React.Dispatch<React.SetStateAction<ToastItem[]>>]} */
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    /**
     * @param {{ message: string, variant?: 'success' | 'error' }} input
     */
    ({ message, variant = 'success' }) => {
      if (!message) return null;
      let nextId = null;
      setItems((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.message === message && last.variant === variant) {
          return [...prev.slice(0, -1), { ...last, count: last.count + 1 }];
        }
        idRef.current += 1;
        nextId = idRef.current;
        const item = { id: nextId, message, variant, count: 1 };
        const trimmed = prev.length >= max ? prev.slice(prev.length - (max - 1)) : prev;
        return [...trimmed, item];
      });
      return nextId;
    },
    [max],
  );

  // 자동 dismiss 타이머 — 항목 추가 시 마운트, 항목 변경 시 재설정.
  useEffect(() => {
    if (items.length === 0) return undefined;
    const timers = items.map((t) => setTimeout(() => dismiss(t.id), duration));
    return () => timers.forEach(clearTimeout);
  }, [items, duration, dismiss]);

  return { items, push, dismiss };
};
