import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api.js';

/**
 * Project 편집/삭제 mutation 묶음 (#208).
 *
 *  - update: name / description 수정 → ['project', id] 캐시 즉시 교체 + ['projects'] 무효화
 *  - remove: 삭제 (OWNER 만 — BE 가 게이트). 성공 시 onDeleteSuccess 콜백으로
 *           라우팅 책임을 상위에 넘긴다.
 *
 * @param {{
 *   projectId: string;
 *   onError: (msg: string) => void;
 *   onUpdateSuccess: () => void;
 *   onDeleteSuccess: () => void;
 * }} args
 */
export const useBoardProjectMutations = ({
  projectId,
  onError,
  onUpdateSuccess,
  onDeleteSuccess,
}) => {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: async (changes) => {
      const res = await api.updateProject(projectId, changes);
      return res.data?.project;
    },
    onSuccess: (project) => {
      if (project) queryClient.setQueryData(['project', projectId], project);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onUpdateSuccess();
    },
    onError: (err) => onError(toFriendlyError(err, 'update')),
  });

  const remove = useMutation({
    mutationFn: async () => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      onDeleteSuccess();
    },
    onError: (err) => onError(toFriendlyError(err, 'delete')),
  });

  return { update, remove };
};

/**
 * @param {unknown} err
 * @param {'update' | 'delete'} kind
 * @returns {string}
 */
const toFriendlyError = (err, kind) => {
  const status = /** @type {{ response?: { status?: number } }} */ (err)?.response?.status;
  const code = /** @type {{ response?: { data?: { error?: string } } }} */ (err)?.response?.data
    ?.error;
  if (code === 'OwnerOnly' || status === 403) {
    return kind === 'delete' ? 'OWNER만 삭제할 수 있어.' : '권한이 없어.';
  }
  if (status === 400) return '입력을 다시 확인해줘.';
  if (status === 404) return '프로젝트를 찾을 수 없어.';
  if (typeof status === 'number' && status >= 500)
    return '서버 오류가 났어. 잠시 후 다시 시도해줘.';
  return kind === 'delete'
    ? '삭제하지 못했어. 잠시 후 다시 시도해줘.'
    : '저장하지 못했어. 잠시 후 다시 시도해줘.';
};
