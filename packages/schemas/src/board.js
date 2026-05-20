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
 * BoardColumn 생성 입력.
 * order는 선택 — 미입력 시 라우터에서 마지막 컬럼 뒤(+1000)로 자동 배치.
 */
export const BoardColumnCreateInput = z.object({
  name: z
    .string({ required_error: '컬럼 이름이 필요합니다' })
    .trim()
    .min(1, '컬럼 이름이 필요합니다')
    .max(40, '컬럼 이름은 40자 이내'),
  order: z.number().finite().optional(),
});

/**
 * BoardColumn 수정 입력 — name / order 중 최소 1개.
 */
export const BoardColumnUpdateInput = z
  .object({
    name: z.string().trim().min(1, '컬럼 이름이 필요합니다').max(40).optional(),
    order: z.number().finite().optional(),
  })
  .refine((d) => d.name !== undefined || d.order !== undefined, {
    message: 'name 또는 order 중 하나는 필요합니다',
  });

/**
 * Card 생성 입력. order는 선택 — 미입력 시 라우터에서 마지막 카드 뒤(+1000)로 자동 배치.
 * assigneeId가 들어오면 라우터에서 프로젝트 멤버 검증.
 */
export const CardCreateInput = z.object({
  title: z
    .string({ required_error: '카드 제목이 필요합니다' })
    .trim()
    .min(1, '카드 제목이 필요합니다')
    .max(200, '카드 제목은 200자 이내'),
  description: z.string().max(5000, '설명은 5000자 이내').optional().nullable(),
  assigneeId: z.string().trim().min(1).optional().nullable(),
  order: z.number().finite().optional(),
});

/**
 * Card 수정 입력 — title / description / assigneeId 중 최소 1개.
 * order 변경은 별도 move 엔드포인트가 담당하므로 여기엔 없다.
 */
export const CardUpdateInput = z
  .object({
    title: z.string().trim().min(1, '카드 제목이 필요합니다').max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    assigneeId: z.string().trim().min(1).optional().nullable(),
  })
  .refine(
    (d) => d.title !== undefined || d.description !== undefined || d.assigneeId !== undefined,
    { message: 'title / description / assigneeId 중 하나는 필요합니다' },
  );

/**
 * Card 이동 입력 — 대상 컬럼 id 필수, order는 선택.
 * order 미입력 시 라우터가 대상 컬럼의 끝 (lastOrder + 1000) 으로 배치.
 */
export const CardMoveInput = z.object({
  columnId: z
    .string({ required_error: 'columnId가 필요합니다' })
    .trim()
    .min(1, 'columnId가 필요합니다'),
  order: z.number().finite().optional(),
});

/**
 * @typedef {z.infer<typeof ProjectCreateInput>} ProjectCreateInputT
 * @typedef {z.infer<typeof ProjectUpdateInput>} ProjectUpdateInputT
 * @typedef {z.infer<typeof ProjectMemberInput>} ProjectMemberInputT
 * @typedef {z.infer<typeof BoardColumnCreateInput>} BoardColumnCreateInputT
 * @typedef {z.infer<typeof BoardColumnUpdateInput>} BoardColumnUpdateInputT
 * @typedef {z.infer<typeof CardCreateInput>} CardCreateInputT
 * @typedef {z.infer<typeof CardUpdateInput>} CardUpdateInputT
 * @typedef {z.infer<typeof CardMoveInput>} CardMoveInputT
 */
