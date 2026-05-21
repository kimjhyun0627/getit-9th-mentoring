import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api.js';

const SHELVES_KEY = ['shelves', 'me'];

/**
 * 내 서재 조회 hook — 단일 페이지 조회.
 *
 * 무한 스크롤이 아닌 곳(SearchPage cross-reference 등)에서 사용.
 * HomePage 는 {@link useInfiniteMyShelves} 사용.
 *
 * @param {{ page?: number; pageSize?: number; sort?: string }} [opts]
 */
export const useMyShelves = (opts = {}) => {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 100;
  const sort = opts.sort;
  return useQuery({
    queryKey: [...SHELVES_KEY, { page, pageSize, sort }],
    queryFn: async () => {
      const res = await api.listMyShelves({ page, pageSize, sort });
      return /** @type {{ shelves: import('../components/BookCard.jsx').Shelf[]; pagination: { page: number; pageSize: number; total: number } }} */ (
        res.data
      );
    },
  });
};

/**
 * 내 서재 무한 스크롤 조회 hook (#525).
 *
 * BE 페이지 기반 API (`pageSize ≤ 100` cap) 를 그대로 활용하고
 * FE 에서 `useInfiniteQuery` 로 누적. 정렬 변경 시 queryKey 변경 → 새 query 시작.
 *
 * `getNextPageParam`:
 *  - `pagination.total` 과 누적 fetch 수를 비교해 더 있을 때만 다음 page 번호 반환.
 *  - total 까지 다 받으면 undefined → `hasNextPage=false`.
 *
 * @param {{ pageSize?: number; sort?: string }} [opts]
 */
export const useInfiniteMyShelves = (opts = {}) => {
  const pageSize = opts.pageSize ?? 30;
  const sort = opts.sort;
  return useInfiniteQuery({
    queryKey: [...SHELVES_KEY, 'infinite', { pageSize, sort }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const res = await api.listMyShelves({ page: pageParam, pageSize, sort });
      /**
       * @type {{
       *   shelves: import('../components/BookCard.jsx').Shelf[];
       *   pagination: { page: number; pageSize: number; total: number; sort?: string };
       * }}
       */
      const payload = res.data;
      return payload;
    },
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage?.pagination?.total ?? 0;
      const loaded = allPages.reduce((sum, p) => sum + (p?.shelves?.length ?? 0), 0);
      if (loaded >= total) return undefined;
      // 응답이 빈 페이지면 (BE 가 total 보다 적게 줄 경우 안전 정지) 종료.
      if ((lastPage?.shelves?.length ?? 0) === 0) return undefined;
      return (lastPage?.pagination?.page ?? allPages.length) + 1;
    },
  });
};

/**
 * 서재 항목 수정 hook — PATCH /shelves/:bookId.
 * 성공 시 'shelves/me' invalidate.
 */
export const useUpdateShelf = () => {
  const qc = useQueryClient();
  return useMutation({
    /**
     * @param {{ bookId: string; status?: 'WANT'|'READING'|'READ'; rating?: number|null; review?: string|null }} input
     */
    mutationFn: async ({ bookId, ...body }) => {
      const res = await api.updateShelf(bookId, body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SHELVES_KEY });
    },
  });
};

/**
 * 서재 항목 제거 hook — DELETE /shelves/:bookId.
 */
export const useRemoveShelf = () => {
  const qc = useQueryClient();
  return useMutation({
    /** @param {{ bookId: string }} input */
    mutationFn: async ({ bookId }) => {
      await api.removeShelf(bookId);
      return { bookId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SHELVES_KEY });
    },
  });
};
