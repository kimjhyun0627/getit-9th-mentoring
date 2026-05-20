import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { HomePage } from './HomePage.jsx';

const samplePost = (over = {}) => ({
  id: over.id ?? 'p1',
  ownerId: over.ownerId ?? 'u1',
  title: over.title ?? '북문 마라탕 같이 갈 사람!',
  body: over.body ?? '오늘 18시',
  meetAt: over.meetAt ?? new Date(Date.now() + 6 * 3600_000).toISOString(),
  capacity: over.capacity ?? 4,
  currentCapacity: over.currentCapacity ?? 2,
  status: over.status ?? 'RECRUITING',
  createdAt: '2026-05-19T08:00:00+09:00',
  updatedAt: '2026-05-19T08:00:00+09:00',
  tags: over.tags ?? [{ id: 't1', name: '마라탕' }],
});

const renderPage = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Header 가 useQuery(api.getMe) 를 호출 — 테스트에서는 비로그인 default.
    vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('헤더의 메인 타이틀과 새 모임 만들기 CTA 를 렌더한다', async () => {
    vi.spyOn(api, 'listPosts').mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    expect(screen.getByText(/오늘 누구랑/)).toBeInTheDocument();
    // CTA 는 헤더 영역 + EmptyCard 영역 양쪽에 있음
    const ctas = await screen.findAllByText(/새 모임 만들기/);
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  it('서버 응답 카드를 렌더한다', async () => {
    vi.spyOn(api, 'listPosts').mockResolvedValue({
      items: [samplePost({ id: 'p1' }), samplePost({ id: 'p2', title: '풋살 한판' })],
      nextCursor: null,
    });
    renderPage();
    expect(await screen.findByText('북문 마라탕 같이 갈 사람!')).toBeInTheDocument();
    expect(await screen.findByText('풋살 한판')).toBeInTheDocument();
  });

  it('빈 응답이어도 EmptyCard placeholder 가 보인다', async () => {
    vi.spyOn(api, 'listPosts').mockResolvedValue({ items: [], nextCursor: null });
    renderPage();
    expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
  });

  it('태그 칩 클릭 시 listPosts 가 tag 파라미터로 재호출된다', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'listPosts').mockResolvedValue({
      items: [samplePost()],
      nextCursor: null,
    });
    renderPage();
    await screen.findByText('북문 마라탕 같이 갈 사람!');

    await user.click(screen.getByRole('button', { name: '#스포츠' }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ tag: '스포츠', limit: 12 }));
    });
  });

  it('검색어가 서버로 전달되고 결과만 표시된다 (#229)', async () => {
    const user = userEvent.setup();
    // listPosts mock — q 파라미터에 따라 결과 분기 (서버 필터를 mock 으로 흉내).
    const spy = vi.spyOn(api, 'listPosts').mockImplementation(async (params = {}) => {
      if (params.q === '풋살') {
        return {
          items: [samplePost({ id: 'futsal', title: '풋살 한판' })],
          nextCursor: null,
        };
      }
      return {
        items: [
          samplePost({ id: 'mara', title: '북문 마라탕' }),
          samplePost({ id: 'futsal', title: '풋살 한판' }),
        ],
        nextCursor: null,
      };
    });
    renderPage();
    await screen.findByText('북문 마라탕');
    await user.type(screen.getByLabelText('태그 또는 장소로 검색'), '풋살');
    // debounce 250ms — q 가 서버로 전달됐는지 확인.
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ q: '풋살' }));
    });
    await waitFor(() => {
      expect(screen.queryByText('북문 마라탕')).not.toBeInTheDocument();
    });
    expect(screen.getByText('풋살 한판')).toBeInTheDocument();
  });

  it('서버 에러 시 alert 메시지를 표시한다', async () => {
    vi.spyOn(api, 'listPosts').mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('모집 목록을 불러오지 못했어');
  });

  it('에러 상태에서 "다시 시도" 버튼을 누르면 listPosts 가 재호출된다', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'listPosts').mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await screen.findByRole('alert');
    expect(spy).toHaveBeenCalledTimes(1);

    // 두 번째 호출은 성공 mock 으로 교체
    spy.mockResolvedValueOnce({ items: [samplePost()], nextCursor: null });
    await user.click(screen.getByRole('button', { name: /다시 시도/ }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('북문 마라탕 같이 갈 사람!')).toBeInTheDocument();
  });

  it('BE 가 HTML 을 status 200 으로 응답하면 (SPA fallback) 에러 UI 를 표시한다', async () => {
    vi.spyOn(api, 'listPosts').mockRejectedValue(new Error('invalid response: expected JSON'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('모집 목록을 불러오지 못했어');
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeInTheDocument();
  });
});
