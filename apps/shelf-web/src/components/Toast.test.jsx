import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastStack } from './Toast.jsx';
import { useToastQueue } from './useToastQueue.js';

/**
 * 다중 토스트 큐 — #294 빠른 연속 추가 시 메시지 머지/카운터.
 *
 * 시간 진행은 vi.useFakeTimers + advanceTimersByTime 으로 결정적으로 검증.
 */
describe('useToastQueue (#294)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('같은 메시지 + variant 연속 push 시 새 토스트가 아니라 count++ 로 머지', () => {
    const { result } = renderHook(() => useToastQueue({ duration: 1000 }));
    act(() => {
      result.current.push({ message: '서재에 담았습니다.' });
      result.current.push({ message: '서재에 담았습니다.' });
      result.current.push({ message: '서재에 담았습니다.' });
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].count).toBe(3);
    expect(result.current.items[0].message).toBe('서재에 담았습니다.');
  });

  it('다른 메시지면 새 토스트로 push', () => {
    const { result } = renderHook(() => useToastQueue({ duration: 1000, max: 5 }));
    act(() => {
      result.current.push({ message: 'A' });
      result.current.push({ message: 'B' });
      result.current.push({ message: 'A' });
    });
    // A, B, A — 마지막 A 는 직전이 B 라 새 토스트.
    expect(result.current.items).toHaveLength(3);
  });

  it('max 초과 시 가장 오래된 토스트 제거', () => {
    const { result } = renderHook(() => useToastQueue({ duration: 5000, max: 2 }));
    act(() => {
      result.current.push({ message: 'A' });
      result.current.push({ message: 'B' });
      result.current.push({ message: 'C' });
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items.map((t) => t.message)).toEqual(['B', 'C']);
  });

  it('duration 지나면 자동 dismiss', () => {
    const { result } = renderHook(() => useToastQueue({ duration: 500 }));
    act(() => {
      result.current.push({ message: 'A' });
    });
    expect(result.current.items).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.items).toHaveLength(0);
  });

  it('빈 메시지는 무시', () => {
    const { result } = renderHook(() => useToastQueue());
    act(() => {
      const id = result.current.push({ message: '' });
      expect(id).toBeNull();
    });
    expect(result.current.items).toHaveLength(0);
  });
});

describe('ToastStack', () => {
  it('items 가 있으면 role=status 로 렌더', () => {
    const items = [{ id: 1, message: 'hi', variant: 'success', count: 1 }];
    render(<ToastStack items={items} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('hi');
  });

  it('count > 1 이면 ×N 카운터가 노출됨', () => {
    const items = [{ id: 1, message: '담았습니다.', variant: 'success', count: 4 }];
    render(<ToastStack items={items} onDismiss={() => {}} />);
    expect(screen.getByText('×4')).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 onDismiss(id) 호출', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    const items = [{ id: 42, message: 'x', variant: 'success', count: 1 }];
    render(<ToastStack items={items} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(onDismiss).toHaveBeenCalledWith(42);
  });

  it('빈 배열이면 아무것도 렌더하지 않음', () => {
    const { container } = render(<ToastStack items={[]} onDismiss={() => {}} />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
