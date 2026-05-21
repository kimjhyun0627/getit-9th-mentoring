import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api.js';

/**
 * PostDetailPage 의 mutation 묶음 (apply / cancel / close) — 파일 분리 (300줄 cap).
 *
 * 낙관 마커 `__pending__` 은 진짜 application id 가 도착하기 전 임시 표식.
 * 그 상태에선 취소 버튼을 활성화해도 호출은 막아야 한다 (CR review #340).
 */
export const PENDING_APPLICATION_ID = '__pending__';

/**
 * @param {string} id postId
 * @param {Array<string>} postKey react-query 키 (['post', id])
 * @param {{ id: string } | null} myApplication
 */
export const usePostDetailMutations = (id, postKey, myApplication) => {
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: () => api.applyPost(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKey });
      const prev = queryClient.getQueryData(postKey);
      // #500: APPROVAL 정책이면 capacity 증가 안 함 (PENDING 은 좌석 점유 X).
      queryClient.setQueryData(postKey, (old) => {
        if (!old) return old;
        const isApproval = old.post.applicationPolicy === 'APPROVAL';
        const nextCapacity = isApproval ? old.post.currentCapacity : old.post.currentCapacity + 1;
        const pendingStatus = isApproval ? 'PENDING' : 'APPROVED';
        return {
          post: {
            ...old.post,
            currentCapacity: nextCapacity,
            myApplication: old.post.myApplication ?? {
              id: PENDING_APPLICATION_ID,
              status: pendingStatus,
              createdAt: '',
            },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(postKey, ctx.prev);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(postKey, (old) =>
        old
          ? {
              post: {
                ...old.post,
                myApplication: {
                  id: data.application.id,
                  status: data.application.status ?? 'APPROVED',
                  createdAt: data.application.createdAt,
                },
              },
            }
          : old,
      );
    },
  });

  const cancel = useMutation({
    mutationFn: () => {
      if (!myApplication?.id || myApplication.id === PENDING_APPLICATION_ID) {
        throw new Error('no application to cancel');
      }
      return api.cancelApplication(myApplication.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: postKey });
      const prev = queryClient.getQueryData(postKey);
      // #500: APPROVED 상태만 capacity 점유. PENDING/REJECTED 는 점유 X → optimistic decrement 안 함.
      queryClient.setQueryData(postKey, (old) => {
        if (!old) return old;
        const wasApproved = (old.post.myApplication?.status ?? 'APPROVED') === 'APPROVED';
        return {
          post: {
            ...old.post,
            currentCapacity: wasApproved
              ? Math.max(0, old.post.currentCapacity - 1)
              : old.post.currentCapacity,
            myApplication: null,
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(postKey, ctx.prev);
    },
  });

  // #244: 방장이 모집 종료. 멱등 — 이미 CLOSED 면 BE 가 그대로 응답.
  const close = useMutation({
    mutationFn: () => api.closePost(id),
    onSuccess: (data) => {
      queryClient.setQueryData(postKey, (old) => (data?.post ? { post: data.post } : old));
    },
  });

  return { apply, cancel, close };
};
