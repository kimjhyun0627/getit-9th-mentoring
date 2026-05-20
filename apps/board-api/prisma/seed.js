/**
 * board-api Prisma seed — 개발/테스트용 더미 프로젝트.
 *
 * 멱등성: name + ownerId 기준 upsert. 같은 (ownerId, name) 이면 갱신.
 *
 * 전제: auth-api seed가 먼저 돌아서 `alice@get-it.cloud` 유저가 존재해야 함.
 * - alice = OWNER, bob = MEMBER
 * - 컬럼: Todo(1000) / Doing(2000) / Done(3000) — between-keys 초기값
 * - 카드 2개 (Todo 컬럼에 1024 / 1536)
 *
 * 실행:
 *   pnpm --filter @getit/board-api prisma:seed
 *   또는 SEED_OWNER_ID=<cuid> SEED_MEMBER_ID=<cuid> 로 직접 주입
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// auth-api seed에서 만든 alice/bob의 id를 환경변수로 받는다.
// dev 환경에선 보통 auth DB와 board DB가 같은 MySQL 인스턴스라
// 직접 SELECT 으로도 가능하지만, 분리 가능성을 고려해 env로만 받는다.
const SEED_OWNER_ID = process.env.SEED_OWNER_ID;
const SEED_MEMBER_ID = process.env.SEED_MEMBER_ID;

const COLUMNS = [
  { name: 'Todo', order: 1000 },
  { name: 'Doing', order: 2000 },
  { name: 'Done', order: 3000 },
];

const CARDS_IN_TODO = [
  { title: '디자인 시안 검토', description: 'minimalist 페르소나 최종 확정', order: 1024 },
  { title: 'API 스펙 확정', description: '/api/projects, /api/columns, /api/cards', order: 1536 },
];

const seedProject = async () => {
  if (!SEED_OWNER_ID) {
    console.warn('SEED_OWNER_ID env가 비어있다. seed skip.');
    console.warn('   auth-api seed 먼저 돌리고, 발급된 alice id를 환경변수로 주입해라.');
    return null;
  }

  // 같은 (ownerId, name)으로 중복 생성 방지. findFirst → create/update 사이의
  // race condition 회피를 위해 $transaction 으로 atomic 하게 묶는다.
  const project = await prisma.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({
      where: { ownerId: SEED_OWNER_ID, name: 'GETIT 9기 멘토링' },
    });

    if (existing) {
      return tx.project.update({
        where: { id: existing.id },
        data: { description: '멘토링 9기 운영 보드 (seed)' },
      });
    }
    return tx.project.create({
      data: {
        ownerId: SEED_OWNER_ID,
        name: 'GETIT 9기 멘토링',
        description: '멘토링 9기 운영 보드 (seed)',
      },
    });
  });

  console.log(`  project: ${project.name} (id=${project.id})`);
  return project;
};

const seedMembers = async (projectId) => {
  const members = [{ userId: SEED_OWNER_ID, role: 'OWNER' }];
  // OWNER 와 같은 id를 가진 MEMBER 푸시 금지 — upsert 가 OWNER role을 MEMBER로 덮어쓴다.
  if (SEED_MEMBER_ID && SEED_MEMBER_ID !== SEED_OWNER_ID) {
    members.push({ userId: SEED_MEMBER_ID, role: 'MEMBER' });
  }

  // 멤버 upsert는 (projectId, userId) unique 기준이라 서로 독립적 → 병렬 실행 가능.
  await Promise.all(
    members.map(async (m) => {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: m.userId } },
        update: { role: m.role },
        create: { projectId, userId: m.userId, role: m.role },
      });
      console.log(`  member: user=${m.userId} role=${m.role}`);
    }),
  );
};

const seedColumns = async (projectId) => {
  // 컬럼은 같은 projectId 안에서 name이 unique 하지 않아 findFirst → create/update.
  // race 방지 위해 각 컬럼 처리를 $transaction 으로 묶고, 컬럼 간엔 독립이라 병렬.
  const created = await Promise.all(
    COLUMNS.map((c) =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.boardColumn.findFirst({
          where: { projectId, name: c.name },
        });
        const column = existing
          ? await tx.boardColumn.update({
              where: { id: existing.id },
              data: { order: c.order },
            })
          : await tx.boardColumn.create({
              data: { projectId, name: c.name, order: c.order },
            });
        console.log(`  column: ${column.name} (order=${column.order})`);
        return column;
      }),
    ),
  );
  return created;
};

const seedCards = async (todoColumnId) => {
  // 카드도 (columnId, title) 기준 멱등 처리. 각 카드 독립이라 병렬 + 트랜잭션.
  await Promise.all(
    CARDS_IN_TODO.map((c) =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.card.findFirst({
          where: { columnId: todoColumnId, title: c.title },
        });
        const card = existing
          ? await tx.card.update({
              where: { id: existing.id },
              data: { description: c.description, order: c.order, assigneeId: SEED_OWNER_ID },
            })
          : await tx.card.create({
              data: {
                columnId: todoColumnId,
                title: c.title,
                description: c.description,
                order: c.order,
                assigneeId: SEED_OWNER_ID,
              },
            });
        console.log(`  card: ${card.title} (order=${card.order})`);
        return card;
      }),
    ),
  );
};

const main = async () => {
  console.log('seeding board-api dev data...');
  const project = await seedProject();
  if (!project) return;

  await seedMembers(project.id);
  const columns = await seedColumns(project.id);
  const todo = columns.find((c) => c.name === 'Todo');
  if (todo) {
    await seedCards(todo.id);
  }
  console.log('done.');
};

// 의도적으로 top-level promise 핸들링: catch/finally 가 이미 붙어있음을
// 정적분석에 명시하기 위해 void 로 표기.
void main()
  .catch((err) => {
    console.error('seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
