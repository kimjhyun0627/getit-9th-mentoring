import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api.js';

/**
 * 컬럼 CRUD mutation 묶음 (#206).
 *  - create: 마지막 + 1000 자동 배치
 *  - rename: name 단독 변경
 *  - remove: 마지막 1개는 BE 가 409 (LastColumn) 로 막음 — FE 는 가드 X (UX 메시지 차원만)
 *
 * 캐시 갱신: ['columns', projectId] 무효화 + cards-batch 도 같이 (cascade 영향).
 *
 * @param {{ projectId: string }} args
 */
export const useBoardColumnMutations = ({ projectId }) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['columns', projectId] });
    queryClient.invalidateQueries({ queryKey: ['cards-batch', projectId] });
  };

  const create = useMutation({
    mutationFn: async ({ name }) => {
      const res = await api.createColumn(projectId, { name });
      return res.data?.column;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ columnId, name }) => {
      const res = await api.updateColumn(projectId, columnId, { name });
      return res.data?.column;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async ({ columnId }) => api.deleteColumn(projectId, columnId),
    onSuccess: invalidate,
  });

  return { create, rename, remove };
};
