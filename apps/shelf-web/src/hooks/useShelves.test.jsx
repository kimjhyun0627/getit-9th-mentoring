import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { useInfiniteMyShelves } from './useShelves.js';

/** 무한 스크롤 hook (#525) 의 페이지네이션 / 종료 조건 가드. */

const makeShelf = (i) => ({
  id: `shelf-${i}`,
  bookId: `book-${i}`,
  status: 'READ',
  rating: 4,
  review: null,
  addedAt: '2026-05-01T00:00:00.000Z',
  completedAt: null,
  book: { id: `book-${i}`, isbn: `978${String(i).padStart(10, '0')}`, title: `책 ${i}` },
});

const wrap = (client) => {
  const Provider = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Provider;
};

describe('useInfiniteMyShelves (#525)', () => {
  let client;
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    client.clear();
  });

  it('첫 페이지 fetch 후 shelves 누적과 hasNextPage=true 가 반환된다 (total > pageSize)', async () => {
    vi.spyOn(api, 'listMyShelves').mockImplementation(async () => ({
      data: {
        shelves: Array.from({ length: 30 }, (_, i) => makeShelf(i)),
        pagination: { page: 1, pageSize: 30, total: 75 },
      },
    }));

    const { result } = renderHook(() => useInfiniteMyShelves({ pageSize: 30 }), {
      wrapper: wrap(client),
    });

    await waitFor(() => expect(result.current.data?.pages?.[0]).toBeDefined(), { timeout: 3000 });
    expect(result.current.data?.pages[0].shelves).toHaveLength(30);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('마지막 페이지 도달 시 hasNextPage=false', async () => {
    vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: {
        shelves: Array.from({ length: 20 }, (_, i) => makeShelf(i)),
        pagination: { page: 1, pageSize: 30, total: 20 },
      },
    });

    const { result } = renderHook(() => useInfiniteMyShelves({ pageSize: 30 }), {
      wrapper: wrap(client),
    });
    await waitFor(() => expect(result.current.data?.pages?.[0]).toBeDefined());
    expect(result.current.hasNextPage).toBe(false);
  });

  it('fetchNextPage 호출 시 다음 page 번호로 api 가 호출되고 결과가 누적된다', async () => {
    const spy = vi.spyOn(api, 'listMyShelves').mockImplementation(async ({ page }) => {
      if (page === 1) {
        return {
          data: {
            shelves: Array.from({ length: 30 }, (_, i) => makeShelf(i)),
            pagination: { page: 1, pageSize: 30, total: 50 },
          },
        };
      }
      return {
        data: {
          shelves: Array.from({ length: 20 }, (_, i) => makeShelf(i + 30)),
          pagination: { page: 2, pageSize: 30, total: 50 },
        },
      };
    });

    const { result } = renderHook(() => useInfiniteMyShelves({ pageSize: 30 }), {
      wrapper: wrap(client),
    });
    await waitFor(() => expect(result.current.data?.pages?.[0]).toBeDefined());
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    expect(spy).toHaveBeenCalledWith({ page: 1, pageSize: 30, sort: undefined });
    expect(spy).toHaveBeenCalledWith({ page: 2, pageSize: 30, sort: undefined });
    const flat = result.current.data?.pages.flatMap((p) => p.shelves) ?? [];
    expect(flat).toHaveLength(50);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('마지막 페이지의 shelves 가 빈 배열이면 hasNextPage=false (BE total drift 안전망)', async () => {
    vi.spyOn(api, 'listMyShelves').mockImplementation(async ({ page }) => {
      if (page === 1) {
        return {
          data: {
            shelves: Array.from({ length: 10 }, (_, i) => makeShelf(i)),
            pagination: { page: 1, pageSize: 30, total: 100 },
          },
        };
      }
      return {
        data: {
          shelves: [],
          pagination: { page, pageSize: 30, total: 100 },
        },
      };
    });

    const { result } = renderHook(() => useInfiniteMyShelves({ pageSize: 30 }), {
      wrapper: wrap(client),
    });
    await waitFor(() => expect(result.current.data?.pages?.[0]).toBeDefined());
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('sort 변경 시 queryKey 변경으로 새 query 가 발사된다', async () => {
    const spy = vi.spyOn(api, 'listMyShelves').mockResolvedValue({
      data: {
        shelves: Array.from({ length: 5 }, (_, i) => makeShelf(i)),
        pagination: { page: 1, pageSize: 30, total: 5 },
      },
    });

    const { result, rerender } = renderHook(({ sort }) => useInfiniteMyShelves({ sort }), {
      wrapper: wrap(client),
      initialProps: { sort: 'addedAt-desc' },
    });
    await waitFor(() => expect(result.current.data?.pages?.[0]).toBeDefined());

    rerender({ sort: 'rating-desc' });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ sort: 'rating-desc' })),
    );
  });
});
