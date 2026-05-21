import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { MessageFormSchema } from '../lib/messageSchema.js';
import { counterColorClass } from '../lib/modalHelpers.js';

/**
 * ComposeModal / EditModal 공통 RHF 셋업.
 *
 * - zodResolver + MessageFormSchema
 * - useWatch 로 content 글자수 추적 (#281)
 * - counterColor 계산 (warn/over 색 분기)
 *
 * defaultValues 만 모달별로 다르다 (Compose: 빈값, Edit: prefill).
 *
 * @param {{ content?: string; color?: string }} [defaultValues]
 */
export const useMessageForm = (defaultValues = { content: '', color: undefined }) => {
  const form = useForm({
    resolver: zodResolver(MessageFormSchema),
    mode: 'onSubmit',
    defaultValues,
  });

  // useWatch 는 form.control 구독 — re-render 최소화 (전체 watch 보다 가벼움).
  const contentValue = useWatch({ control: form.control, name: 'content' }) ?? '';
  const contentLen = contentValue.length;
  const counterColor = counterColorClass(contentLen);

  return { ...form, contentLen, counterColor };
};
