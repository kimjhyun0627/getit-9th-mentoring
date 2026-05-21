import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDocumentVisible } from './useDocumentVisible.js';

const setHidden = (hidden) => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useDocumentVisible', () => {
  afterEach(() => {
    setHidden(false);
    vi.restoreAllMocks();
  });

  it('초기값: document.hidden=false → true 반환', () => {
    setHidden(false);
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);
  });

  it('document.hidden=true 로 토글되면 false 반환', () => {
    const { result } = renderHook(() => useDocumentVisible());
    act(() => setHidden(true));
    expect(result.current).toBe(false);
  });

  it('hidden=true → false 로 다시 토글되면 true 반환', () => {
    const { result } = renderHook(() => useDocumentVisible());
    act(() => setHidden(true));
    expect(result.current).toBe(false);
    act(() => setHidden(false));
    expect(result.current).toBe(true);
  });

  it('unmount 시 listener 정리 — 후속 토글이 leak warning 안 만듦', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useDocumentVisible());
    unmount();
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
