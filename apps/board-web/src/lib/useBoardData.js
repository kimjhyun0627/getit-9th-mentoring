import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { api } from './api.js';

/**
 * BoardViewPage 의 데이터 fetch 묶음.
 *
 *  - project / columns / cards-batch (#258, N+1 회피)
 *  - cards-batch 응답을 per-column ['cards', col.id] 캐시로 hydrate 해
 *    기존 카드 mutation (create/move/remove/update) 들이 그대로 작동하게 한다.
 *
 * 반환:
 *  - projectQuery / columnsQuery / cardsBatchQuery
 *  - columns, cardsByColumn (mutation 후 per-column 캐시 우선)
 *
 * @param {string} projectId
 */
export const useBoardData = (projectId) => {
  const queryClient = useQueryClient();

  // 403/404 는 재시도 안 함 (권한/존재 문제는 retry 무의미). #238
  const shouldRetry = (count, err) => {
    const status = /** @type {{ response?: { status?: number } }} */ (err)?.response?.status;
    if (status === 403 || status === 404) return false;
    return count < 2;
  };

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await api.getProject(projectId);
      return res.data?.project;
    },
    enabled: Boolean(projectId),
    retry: shouldRetry,
  });

  const columnsQuery = useQuery({
    queryKey: ['columns', projectId],
    queryFn: async () => {
      const res = await api.listColumns(projectId);
      return res.data?.columns ?? [];
    },
    enabled: Boolean(projectId),
    retry: shouldRetry,
  });

  const cardsBatchQuery = useQuery({
    queryKey: ['cards-batch', projectId],
    queryFn: async () => {
      const res = await api.listCardsBatch(projectId);
      return res.data?.cardsByColumn ?? {};
    },
    enabled: Boolean(projectId),
    retry: shouldRetry,
  });

  const columns = useMemo(() => columnsQuery.data ?? [], [columnsQuery.data]);

  // batch 응답을 per-column ['cards', col.id] 캐시로 hydrate.
  // 그 결과 카드 mutation 들(setQueryData on ['cards', colId])이 그대로 작동하고,
  // 아래 useQueries 가 변경을 구독해 re-render 를 일으킨다.
  useEffect(() => {
    const map = cardsBatchQuery.data;
    if (!map) return;
    for (const [colId, cards] of Object.entries(map)) {
      queryClient.setQueryData(['cards', colId], cards);
    }
  }, [cardsBatchQuery.data, queryClient]);

  // 컬럼별 카드 변화를 구독 — fetch 는 안 한다 (queryFn 가 즉시 캐시 값 반환).
  // mutation 의 onMutate / onSuccess 가 ['cards', colId] 를 갱신하면 여기서 re-render.
  const cardQueries = useQueries({
    queries: columns.map((col) => ({
      queryKey: ['cards', col.id],
      // batch 가 채워두므로 fetch 안 함. cache 미스 시엔 빈 배열 (drop-in safe).
      queryFn: () => Promise.resolve(queryClient.getQueryData(['cards', col.id]) ?? []),
      enabled: Boolean(col.id) && Boolean(cardsBatchQuery.data),
      staleTime: Infinity,
    })),
  });

  const cardsByColumn = useMemo(() => {
    /** @type {Record<string, Array<any>>} */
    const map = {};
    columns.forEach((col, idx) => {
      map[col.id] = cardQueries[idx]?.data ?? [];
    });
    return map;
  }, [columns, cardQueries]);

  return { projectQuery, columnsQuery, cardsBatchQuery, columns, cardsByColumn };
};
