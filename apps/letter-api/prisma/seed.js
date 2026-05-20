/**
 * Prisma seed — 개발/테스트용 더미 메시지.
 *
 * 멱등성: 매 실행마다 deleteMany + createMany로 5건 재시드.
 * authorId는 가짜 cuid 문자열 (BE/FE 통합 전엔 cross-DB FK 없으므로 OK).
 *
 * 색상은 4종 (PINK / MINT / LEMON / LAVENDER) 골고루.
 *
 * 실행: `pnpm --filter @getit/letter-api prisma:seed`
 *       또는 `pnpm --filter @getit/letter-api exec prisma db seed`
 *
 * 안전 가드: production 환경에서 실수로 실행 시 DB 전체가 날아가므로
 * NODE_ENV=production 이면 SEED_CONFIRM=YES 가 명시되어야만 실행한다.
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const SEED_MESSAGES = [
  {
    authorId: 'seed-user-alice',
    content: '9기 화이팅! 다들 졸업 잘하자.',
    color: 'PINK',
  },
  {
    authorId: 'seed-user-bob',
    content: '같이 프로젝트해서 즐거웠어. 또 보자!',
    color: 'MINT',
  },
  {
    authorId: 'seed-user-carol',
    content: '멘토님 감사했습니다. 많이 배웠어요.',
    color: 'LEMON',
  },
  {
    authorId: 'seed-user-alice',
    content: '겨울방학 잘 보내고 새 학기에 봐!',
    color: 'LAVENDER',
  },
  {
    authorId: 'seed-user-dave',
    content: '취미메이트 모집글 다 같이 올려보자ㅋㅋ',
    color: 'PINK',
  },
];

const prisma = new PrismaClient();

const main = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_CONFIRM !== 'YES') {
    throw new Error('seed aborted: NODE_ENV=production. SEED_CONFIRM=YES 를 명시해야 실행 가능.');
  }
  console.log(`seeding letter-api dev messages...`);
  await prisma.message.deleteMany({});
  await prisma.message.createMany({ data: SEED_MESSAGES });
  const count = await prisma.message.count();
  console.log(`  seeded: ${count} messages`);
  console.log(`done.`);
};

main()
  .catch((err) => {
    console.error('seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
