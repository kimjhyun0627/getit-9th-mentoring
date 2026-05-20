/**
 * MePage 단위 테스트 (#228) — 탭 전환 + 데이터 렌더 + 취소 mutation.
 *
 * 비로그인 redirect 는 jsdom 환경에서 window.location.href 가 setter 호출만 되고
 * 실제 이동은 없어, status 메시지로만 검증.
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { MePage } from './MePage.jsx';

const renderPage = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter>
          <MePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

const samplePost = (over = {}) => ({
  id: over.id ?? 'p1',
  ownerId: over.ownerId ?? 'me-id',
  title: over.title ?? '북문 마라탕',
  body: '오늘 18시',
  meetAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
  capacity: 4,
  currentCapacity: 2,
  status: over.status ?? 'RECRUITING',
  createdAt: '2026-05-19T08:00:00+09:00',
  updatedAt: '2026-05-19T08:00:00+09:00',
  tags: [{ id: 't1', name: '음식' }],
});

describe('MePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('비로그인이면 로그인 페이지로 이동 안내', async () => {
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
    // window.location.href 세팅 가로채기.
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: 'about:blank', origin: 'https://hobby.get-it.cloud' },
    });
    renderPage();
    expect(await screen.findByText(/로그인 페이지로 이동 중/)).toBeInTheDocument();
  });

  it('로그인 → "내가 만든 모임" 탭 카드 렌더', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'me-id', name: 'Alice', email: 'a@x.com' });
    vi.spyOn(api, 'listMyPosts').mockResolvedValue({
      items: [samplePost({ id: 'a1', title: '내 모임 A' })],
      nextCursor: null,
    });
    renderPage();
    expect(await screen.findByText('내 모임 A')).toBeInTheDocument();
  });

  it('"내가 신청한 모임" 탭 클릭 → listMyApplications 호출 + 취소 동작', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'me-id', name: 'Alice', email: 'a@x.com' });
    vi.spyOn(api, 'listMyPosts').mockResolvedValue({ items: [], nextCursor: null });
    const listAppSpy = vi.spyOn(api, 'listMyApplications').mockResolvedValue({
      items: [
        {
          id: 'app1',
          postId: 'p1',
          createdAt: new Date().toISOString(),
          post: samplePost({ id: 'p1', title: '신청한 모임' }),
        },
      ],
      nextCursor: null,
    });
    const cancelSpy = vi.spyOn(api, 'cancelApplication').mockResolvedValue();

    renderPage();
    await screen.findByText('내 모임'); // 헤더 텍스트
    await user.click(screen.getByRole('tab', { name: /내가 신청한 모임/ }));
    await waitFor(() => expect(listAppSpy).toHaveBeenCalled());
    expect(await screen.findByText('신청한 모임')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /신청 취소/ }));
    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith('app1'));
  });
});
