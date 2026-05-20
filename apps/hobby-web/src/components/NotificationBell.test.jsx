/**
 * NotificationBell — 알림 벨 + 드롭다운 컴포넌트 단위 테스트 (#229).
 *
 * 검증 포인트:
 *  - enabled=false → 렌더 안 함 (비로그인)
 *  - unreadCount > 0 → 배지 노출
 *  - 클릭 시 드롭다운 open + 항목 렌더
 *  - 항목 클릭 → markNotificationRead 호출
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { NotificationBell } from './NotificationBell.jsx';

const renderBell = (enabled = true) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter>
          <NotificationBell enabled={enabled} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('NotificationBell', () => {
  it('enabled=false → 아무 것도 렌더 안 함', () => {
    renderBell(false);
    expect(screen.queryByLabelText(/알림/)).not.toBeInTheDocument();
  });

  it('unreadCount > 0 → 배지 노출', async () => {
    vi.spyOn(api, 'listNotifications').mockResolvedValue({
      items: [
        {
          id: 'n1',
          userId: 'u1',
          postId: 'p1',
          kind: 'MATCH_FULL',
          message: '마라탕 모집이 마감됐어요',
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      nextCursor: null,
      unreadCount: 3,
    });
    renderBell();
    expect(await screen.findByLabelText('알림 3개')).toBeInTheDocument();
  });

  it('클릭 시 드롭다운 open + 항목 + 클릭 시 markRead 호출', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listNotifications').mockResolvedValue({
      items: [
        {
          id: 'n1',
          userId: 'u1',
          postId: 'p1',
          kind: 'MATCH_FULL',
          message: '풋살 모집이 마감됐어요',
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      nextCursor: null,
      unreadCount: 1,
    });
    const markSpy = vi.spyOn(api, 'markNotificationRead').mockResolvedValue();

    renderBell();
    const bell = await screen.findByLabelText('알림 1개');
    await user.click(bell);
    expect(await screen.findByText('풋살 모집이 마감됐어요')).toBeInTheDocument();
    await user.click(screen.getByText('풋살 모집이 마감됐어요'));
    await waitFor(() => expect(markSpy).toHaveBeenCalledWith('n1'));
  });

  it('빈 상태 — 아직 알림이 없어 안내 노출', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listNotifications').mockResolvedValue({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    });
    renderBell();
    const bell = await screen.findByLabelText('알림');
    await user.click(bell);
    expect(await screen.findByText('아직 알림이 없어')).toBeInTheDocument();
  });
});
