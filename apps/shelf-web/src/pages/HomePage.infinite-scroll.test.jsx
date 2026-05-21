import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { HomePage } from './HomePage.jsx';

/**
 * HomePage 무한 스크롤 가드 (#525) — `HomePage.test.jsx` 가 300줄 상한을 넘지 않도록
 * 무한 스크롤 시나리오만 분리.
 *
 * 가드:
 *  - sentinel intersect → fetchNextPage → page 2 누적 렌더
 *  - 끝 도달 시 "모든 책을 봤어요" 안내
 *  - 기존 Pagination UI 부재
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

/** 1..N 번 책 행 생성 헬퍼. */
const makeShelfRow = (i) => ({
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
});

const pageOf = (start, count, total) => ({
  data: {
    shelves: Array.from({ length: count }, (_, i) => makeShelfRow(start + i)),
    pagination: { page: Math.ceil(start / 30), pageSize: 30, total },
  },
});

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

describe('HomePage — 무한 스크롤 (#525)', () => {
  let observerInstances;
  beforeEach(() => {
    vi.restoreAllMocks();
    observerInstances = setupObserverMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sentinel intersect 시 fetchNextPage → 다음 페이지가 누적된다', async () => {
    const spy = vi.spyOn(api, 'listMyShelves').mockImplementation(async ({ page }) => {
      if (page === 1) return pageOf(1, 30, 45);
      return pageOf(31, 15, 45);
    });

    renderHome();
    await screen.findByRole('heading', { name: '책 1' });
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      observerInstances[0]?.trigger();
    });

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2 }));
    expect(await screen.findByRole('heading', { name: '책 31' })).toBeInTheDocument();
  });

  it('hasNextPage=false 이면 "모든 책을 봤어요" 안내가 노출된다', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue(pageOf(1, 30, 30));
    renderHome();
    expect(await screen.findByText(/모든 책을 봤어요/)).toBeInTheDocument();
  });

  it('Pagination UI 가 더 이상 렌더되지 않는다 (회귀 가드)', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue(pageOf(1, 30, 100));
    renderHome();
    await screen.findByRole('heading', { name: '책 1' });
    expect(screen.queryByTestId('shelf-pagination')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '서재 페이지' })).not.toBeInTheDocument();
  });
});
