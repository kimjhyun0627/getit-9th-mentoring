import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api.js';

const SHELVES_KEY = ['shelves', 'me'];

/**
 * 내 서재 조회 hook.
 *
 * @param {{ page?: number; pageSize?: number }} [opts]
 */
export const useMyShelves = (opts = {}) => {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 100;
  return useQuery({
    queryKey: [...SHELVES_KEY, { page, pageSize }],
    queryFn: async () => {
      const res = await api.listMyShelves({ page, pageSize });
      return /** @type {{ shelves: import('../components/BookCard.jsx').Shelf[]; pagination: { page: number; pageSize: number; total: number } }} */ (
        res.data
      );
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
