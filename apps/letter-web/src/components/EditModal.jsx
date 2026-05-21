import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { useMessageForm } from '../hooks/useMessageForm.js';
import { api } from '../lib/api.js';
import { editError } from '../lib/messageErrors.js';

import { MessageDialog } from './MessageDialog.jsx';
import { MessageForm } from './MessageForm.jsx';

/**
 * EditModal — 본인 메시지 편집 모달 (Issue #249).
 *
 * PATCH /api/messages/:id, initial 값 prefill, mini-diff (#487).
 * dialog shell + form 본문은 공통 컴포넌트 (MessageDialog / MessageForm) 사용.
 *
 * @typedef {object} EditTarget
 * @property {string} id - 메시지 PK (cuid).
 * @property {string} content - 현재 본문 (편집 폼 initial value).
 * @property {'PINK'|'MINT'|'LEMON'|'LAVENDER'} color - 현재 색상 (편집 폼 initial value).
 *
 * @param {{
 *   open: boolean;
 *   message: EditTarget | null;
 *   onClose: () => void;
 *   onSuccess?: () => void;
 * }} props
 */
export const EditModal = ({ open, message, onClose, onSuccess }) => {
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

  // open / message 바뀔 때마다 초기값 채움. 닫혀있을 땐 reset 안 함 (마운트 X).
  useEffect(() => {
    if (open && message) {
      setServerError(null);
      reset({ content: message.content, color: message.color });
    }
  }, [open, message, reset]);

  const mutation = useMutation({
    mutationFn: (body) => api.updateMessage(message?.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => setServerError(editError(err)),
  });

  // Gemini(#512) — open=true 인데 message=null 인 race 윈도우에서
  //   hook side-effect 가 미리 발화하는 케이스 방지. 실제 보일 때만 활성화.
  const isVisible = open && !!message;

  /** @param {{ content: string; color: string }} values */
  const onSubmit = (values) => {
    // #487 — values.content 는 zodResolver .trim() 으로 trimmed. BE 도 trim 저장.
    //   leading/trailing space 만 차이여도 안전하게 no-op 처리.
    const contentChanged = values.content !== message.content;
    const colorChanged = values.color !== message.color;
    if (!contentChanged && !colorChanged) {
      onClose();
      return;
    }
    setServerError(null);
    // #487 — mini-diff: 변경된 필드만 PATCH. MessageUpdateInput 는 partial.
    /** @type {{ content?: string; color?: string }} */
    const patch = {};
    if (contentChanged) patch.content = values.content;
    if (colorChanged) patch.color = values.color;
    mutation.mutate(patch);
  };

  return (
    <MessageDialog
      open={isVisible}
      onClose={onClose}
      headingId={headingId}
      backdropTestId="edit-modal-backdrop"
      initialSelector="#edit-content"
      eyebrow="고쳐 적기"
      title="메시지 수정"
      subtitle="한 줄 다시 다듬어볼게요."
    >
      <MessageForm
        ariaLabel="메시지 수정 폼"
        textareaId="edit-content"
        register={register}
        control={control}
        errors={errors}
        serverError={serverError}
        contentLen={contentLen}
        counterColor={counterColor}
        submitting={isSubmitting || mutation.isPending}
        submitIdleLabel="고치기"
        submitPendingLabel="고치는 중…"
        onCancel={onClose}
        onSubmit={handleSubmit(onSubmit)}
      />
    </MessageDialog>
  );
};
