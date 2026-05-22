import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { HomePage } from './HomePage.jsx';

/**
 * 무한 스크롤(#525) 가드는 `HomePage.infinite-scroll.test.jsx` 로 분리 — 본 파일은
 * 기본 UI / 필터 / 모달 / 정렬 회귀 가드만 (300줄 cap 준수).
 *
 * IntersectionObserver 가 없는 환경에서도 `useInfiniteScroll` 은 no-op 으로 동작하므로
 * 본 파일은 별도 IO mock 필요 없음.
 */

const makeShelf = (i, overrides = {}) => ({
  id: `shelf-${i}`,
  bookId: `book-${i}`,
  status: 'READ',
  rating: 5,
  review: null,
  addedAt: '2026-04-10T00:00:00.000Z',
  completedAt: '2026-04-12T00:00:00.000Z',
  book: {
    id: `book-${i}`,
    isbn: `978${String(i).padStart(10, '0')}`,
    title: `책 ${i}`,
    author: '저자',
    coverUrl: null,
  },
  ...overrides,
});

const shelves = [
  makeShelf(1, {
    status: 'READ',
    review: '읽기의 계절 감상',
    book: {
      id: 'book-1',
      isbn: '9788900000001',
      title: '읽기의 계절',
      author: '김연수',
      coverUrl: null,
    },
  }),
  makeShelf(2, {
    status: 'READING',
    rating: 0,
    book: {
      id: 'book-2',
      isbn: '9788900000002',
      title: '여름의 문장',
      author: '박서영',
      coverUrl: null,
    },
  }),
  makeShelf(3, {
    status: 'WANT',
    rating: 0,
    book: {
      id: 'book-3',
      isbn: '9788900000003',
      title: '빛이 머무는 방',
      author: '정세랑',
      coverUrl: null,
    },
  }),
];

const renderHome = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <HomePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('HomePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('서재 목록 fetch 후 책 카드들을 렌더한다', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 30, total: 3 } },
    });
    renderHome();
    expect(await screen.findByRole('heading', { name: '읽기의 계절' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '여름의 문장' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '빛이 머무는 방' })).toBeInTheDocument();
  });

  it('hero에 "나의 도서관" 헤딩이 있다', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 30, total: 3 } },
    });
    renderHome();
    expect(await screen.findByRole('heading', { name: /나의 도서관/ })).toBeInTheDocument();
  });

  it('필터 탭: Reading 만 보이게 1권만 남는다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 30, total: 3 } },
    });
    renderHome();
    await screen.findByRole('heading', { name: '읽기의 계절' });
    await user.click(screen.getByRole('button', { name: /^Reading/ }));
    expect(screen.getByRole('heading', { name: '여름의 문장' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '읽기의 계절' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '빛이 머무는 방' })).not.toBeInTheDocument();
  });

  it('서재 비어 있으면 empty placeholder 노출', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves: [], pagination: { page: 1, pageSize: 30, total: 0 } },
    });
    renderHome();
    expect(await screen.findByText(/서가가 아직 비어 있습니다/)).toBeInTheDocument();
  });

  it('책 카드 클릭 → 편집 모달 오픈', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 30, total: 3 } },
    });
    renderHome();
    const card = await screen.findByRole('button', { name: /읽기의 계절 자세히 보기/ });
    await user.click(card);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('편집 저장 → updateShelf API 호출', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 30, total: 3 } },
    });
    const updateSpy = vi
      .spyOn(api, 'updateShelf')
      .mockResolvedValue({ data: { shelf: { ...shelves[0], rating: 4 } } });
    renderHome();
    const card = await screen.findByRole('button', { name: /읽기의 계절 자세히 보기/ });
    await user.click(card);
    await user.click(screen.getByRole('radio', { name: '별점 4점' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('book-1', expect.objectContaining({ rating: 4 }));
    });
  });

  it('500 응답 시 에러 메시지', async () => {
    vi.spyOn(api, 'listMyShelves').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { error: 'InternalError' } },
    });
    renderHome();
    expect(await screen.findByText(/지금은 서가를 펼칠 수 없습니다/)).toBeInTheDocument();
  });

  it('401 응답 시 RequireSignIn 카드(로그인하러 가기 버튼) 노출 — #531', async () => {
    vi.spyOn(api, 'listMyShelves').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: 'Unauthorized' } },
    });
    renderHome();
    expect(await screen.findByRole('link', { name: /로그인하러 가기/ })).toBeInTheDocument();
    // 기존 "로그인이 필요합니다." 빨간 텍스트는 401 케이스에서 더 이상 노출되지 않는다.
    expect(screen.queryByText(/^로그인이 필요합니다\.$/)).not.toBeInTheDocument();
  });

  it('SortControl 노출 + 변경 시 listMyShelves 가 새 sort 파라미터로 호출된다 (#196)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: { shelves, pagination: { page: 1, pageSize: 30, total: 3 } },
    });
    renderHome();
    await screen.findByRole('heading', { name: '읽기의 계절' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'addedAt-desc' }));

    await user.selectOptions(screen.getByRole('combobox', { name: /정렬/ }), 'rating-desc');
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'rating-desc' }));
    });

    const beforeResetCalls = spy.mock.calls.length;
    await user.selectOptions(screen.getByRole('combobox', { name: /정렬/ }), 'addedAt-desc');
    await waitFor(() => {
      expect(spy.mock.calls.length).toBeGreaterThan(beforeResetCalls);
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'addedAt-desc' }));
    });
  });

  // 무한 스크롤(#525) 가드는 `HomePage.infinite-scroll.test.jsx` 로 분리.
});
