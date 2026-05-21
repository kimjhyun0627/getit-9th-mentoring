import { z } from 'zod';

import { STICKY_COLORS } from '../components/ColorPicker.jsx';

import { CONTENT_MAX } from './modalHelpers.js';

/**
 * ComposeModal / EditModal 공통 폼 스키마.
 *
 * - content: trim 후 1~CONTENT_MAX 자. BE `MessageCreateInput` 과 동일 규칙 (#323).
 * - color: STICKY_COLORS 의 value 중 하나. "미선택" 케이스에도 친화 메시지
 *   (z.enum 대신 union+refine 으로 한국어 안내).
 *
 * 두 모달이 동일 검증을 쓰는 게 디폴트. 향후 분기 필요해지면 `.extend()` / `.merge()` 가능.
 */
export const COLOR_VALUES = STICKY_COLORS.map((c) => c.value);

export const MessageFormSchema = z.object({
  content: z
    .string({ required_error: '한 줄 적어주세요' })
    .trim()
    .min(1, '한 줄 적어주세요')
    .max(CONTENT_MAX, '500자까지 적을 수 있어요'),
  color: z
    .union([z.string(), z.undefined(), z.null()])
    .refine((v) => typeof v === 'string' && COLOR_VALUES.includes(v), {
      message: '포스트잇 색을 골라주세요',
    }),
});
