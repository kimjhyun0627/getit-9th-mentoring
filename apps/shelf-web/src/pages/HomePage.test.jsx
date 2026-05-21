import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { HomePage } from './HomePage.jsx';

/**
 * IntersectionObserver mock — trigger 로 sentinel intersect 시뮬레이션.
 * 무한 스크롤(#525) 가드: 화면 끝 진입 시 fetchNextPage 가 발사되는지 검증.
 */
const setupObserverMock = () => {
  const instances = [];
  class MockIO {
    constructor(cb) {
      this.cb = cb;
      this.observed = [];
      instances.push(this);
    }
    observe(el) {
      this.observed.push(el);
    }
    unobserve() {}
    disconnect() {
      this.observed = [];
    }
    trigger() {
      this.cb(this.observed.map((target) => ({ isIntersecting: true, target })));
    }
  }
  vi.stubGlobal('IntersectionObserver', MockIO);
  return instances;
};

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
  let observerInstances;
  beforeEach(() => {
    vi.restoreAllMocks();
    observerInstances = setupObserverMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  // #525 — 무한 스크롤 가드.

  it('sentinel intersect 시 fetchNextPage 가 호출되어 다음 페이지가 누적된다', async () => {
    const spy = vi.spyOn(api, 'listMyShelves').mockImplementation(async ({ page }) => {
      if (page === 1) {
        return {
          data: {
            shelves: Array.from({ length: 30 }, (_, i) =>
              makeShelf(i + 1, {
                book: {
                  id: `book-${i + 1}`,
                  isbn: `978${String(i + 1).padStart(10, '0')}`,
                  title: `책 ${i + 1}`,
                  author: '저자',
                  coverUrl: null,
                },
              }),
            ),
            pagination: { page: 1, pageSize: 30, total: 45 },
          },
        };
      }
      return {
        data: {
          shelves: Array.from({ length: 15 }, (_, i) =>
            makeShelf(i + 31, {
              book: {
                id: `book-${i + 31}`,
                isbn: `978${String(i + 31).padStart(10, '0')}`,
                title: `책 ${i + 31}`,
                author: '저자',
                coverUrl: null,
              },
            }),
          ),
          pagination: { page: 2, pageSize: 30, total: 45 },
        },
      };
    });

    renderHome();
    await screen.findByRole('heading', { name: '책 1' });
    expect(spy).toHaveBeenCalledTimes(1);

    // sentinel observer trigger → fetchNextPage 발사.
    await act(async () => {
      observerInstances[0]?.trigger();
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));

    // 2페이지 책도 렌더됨.
    expect(await screen.findByRole('heading', { name: '책 31' })).toBeInTheDocument();
  });

  it('hasNextPage=false 이면 "모든 책을 봤어요" 안내가 노출된다', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: {
        shelves: Array.from({ length: 30 }, (_, i) =>
          makeShelf(i + 1, {
            book: {
              id: `book-${i + 1}`,
              isbn: `978${String(i + 1).padStart(10, '0')}`,
              title: `책 ${i + 1}`,
              author: '저자',
              coverUrl: null,
            },
          }),
        ),
        pagination: { page: 1, pageSize: 30, total: 30 },
      },
    });
    renderHome();
    expect(await screen.findByText(/모든 책을 봤어요/)).toBeInTheDocument();
  });

  it('Pagination UI 가 더 이상 렌더되지 않는다 (#525 회귀 가드)', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: {
        shelves: Array.from({ length: 30 }, (_, i) =>
          makeShelf(i + 1, {
            book: {
              id: `book-${i + 1}`,
              isbn: `978${String(i + 1).padStart(10, '0')}`,
              title: `책 ${i + 1}`,
              author: '저자',
              coverUrl: null,
            },
          }),
        ),
        pagination: { page: 1, pageSize: 30, total: 100 },
      },
    });
    renderHome();
    await screen.findByRole('heading', { name: '책 1' });
    expect(screen.queryByTestId('shelf-pagination')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '서재 페이지' })).not.toBeInTheDocument();
  });
});
