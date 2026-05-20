/**
 * board 도메인 Zod 스키마 — FE/BE 공유.
 *
 * - Project CRUD 입력 / 응답
 * - 멤버 초대 입력
 *
 * board-api 라우터(`apps/board-api/src/routes/*`)에서 입력 검증에 사용한다.
 */
import { z } from 'zod';

/**
 * Project 생성 입력 — 본문 description은 선택.
 */
export const ProjectCreateInput = z.object({
  name: z
    .string({ required_error: '프로젝트 이름이 필요합니다' })
    .trim()
    .min(1, '프로젝트 이름이 필요합니다')
    .max(80, '프로젝트 이름은 80자 이내'),
  description: z.string().max(2000, '설명은 2000자 이내').optional(),
});

/**
 * Project 수정 입력 — 모든 필드 optional이지만 최소 1개 이상 와야 한다.
 */
export const ProjectUpdateInput = z
  .object({
    name: z.string().trim().min(1, '프로젝트 이름이 필요합니다').max(80).optional(),
    description: z.string().max(2000).optional().nullable(),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, {
    message: 'name 또는 description 중 하나는 필요합니다',
  });

/**
 * Project 멤버 초대 입력.
 * userId는 auth-api Users.id (cuid).
 */
export const ProjectMemberInput = z.object({
  userId: z.string().trim().min(1, 'userId가 필요합니다'),
  role: z.enum(['OWNER', 'MEMBER']).optional(),
});

/**
 * @typedef {z.infer<typeof ProjectCreateInput>} ProjectCreateInputT
 * @typedef {z.infer<typeof ProjectUpdateInput>} ProjectUpdateInputT
 * @typedef {z.infer<typeof ProjectMemberInput>} ProjectMemberInputT
 */
