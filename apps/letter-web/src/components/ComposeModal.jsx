import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useMessageForm } from '../hooks/useMessageForm.js';
import { api } from '../lib/api.js';
import { composeError } from '../lib/messageErrors.js';

import { MessageDialog } from './MessageDialog.jsx';
import { MessageForm } from './MessageForm.jsx';

/**
 * 메시지 작성 모달 (Issue #55).
 *
 * RHF+Zod 검증 / POST /api/messages / backdrop+Escape 닫기 / Warm 4색 스와치.
 * dialog shell + form 본문은 공통 컴포넌트 (MessageDialog / MessageForm) 사용.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   onSuccess?: (message: { id: string; content: string; color: string; is_mine: boolean }) => void;
 * }} props
 */
export const ComposeModal = ({ open, onClose, onSuccess }) => {
  const headingId = useId();
  const [serverError, setServerError] = useState(/** @type {string | null} */ (null));
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    contentLen,
    counterColor,
  } = useMessageForm({ content: '', color: undefined });

  const mutation = useMutation({
    mutationFn: (body) => api.createMessage(body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      onSuccess?.(res?.data?.message);
      reset({ content: '', color: undefined });
      onClose();
    },
    onError: (err) => setServerError(composeError(err)),
  });

  // 모달 열릴 때마다 state 리셋 (이전 에러 / 입력 흔적 제거).
  useEffect(() => {
    if (open) {
      setServerError(null);
      reset({ content: '', color: undefined });
    }
  }, [open, reset]);

  /** @param {{ content: string; color: string }} values */
  const onSubmit = (values) => {
    setServerError(null);
    mutation.mutate(values);
  };

  return (
    <MessageDialog
      open={open}
      onClose={onClose}
      headingId={headingId}
      backdropTestId="compose-modal-backdrop"
      initialSelector="#compose-content"
      eyebrow="한 줄 남기기"
      title="메시지 작성"
      subtitle="익명으로 부원실 벽에 살며시 붙여둘게요."
      extraSubtitle="이름은 다른 부원에게 표시되지 않아요."
    >
      <MessageForm
        ariaLabel="메시지 작성 폼"
        textareaId="compose-content"
        placeholder="고마운 마음, 응원, 추억 — 한 줄이면 충분해요"
        register={register}
        control={control}
        errors={errors}
        serverError={serverError}
        contentLen={contentLen}
        counterColor={counterColor}
        submitting={isSubmitting || mutation.isPending}
        submitIdleLabel="붙이기"
        submitPendingLabel="붙이는 중…"
        onCancel={onClose}
        onSubmit={handleSubmit(onSubmit)}
      />
    </MessageDialog>
  );
};
