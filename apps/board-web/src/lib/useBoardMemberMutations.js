import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './api.js';
import { toFriendlyMemberError } from './boardErrorMessages.js';

/**
 * 멤버 초대/추방 mutation 묶음. 성공 시 ['members', projectId] + 프로젝트/목록 cache invalidate.
 *
 * @param {{ projectId: string; onError: (msg: string) => void; onSuccess: () => void }} options
 */
export const useBoardMemberMutations = ({ projectId, onError, onSuccess }) => {
  const queryClient = useQueryClient();

  const invalidateMembership = () => {
    queryClient.invalidateQueries({ queryKey: ['members', projectId] });
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const invite = useMutation({
    mutationFn: async ({ userId }) => api.inviteMember(projectId, { userId }),
    onSuccess: () => {
      onSuccess();
      invalidateMembership();
    },
    onError: (err) => onError(toFriendlyMemberError(err)),
  });

  const remove = useMutation({
    mutationFn: async ({ userId }) => api.removeMember(projectId, userId),
    onSuccess: () => {
      onSuccess();
      invalidateMembership();
    },
    onError: (err) => onError(toFriendlyMemberError(err)),
  });

  return { invite, remove };
};
