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

/**
 * production 안전 가드. NODE_ENV=production 이면 SEED_CONFIRM=YES 가 명시되어야만 허용.
 * 단위 테스트(tests/seed-guard.test.js)에서 import 해서 검증한다.
 *
 * @param {object} opts
 * @param {string} [opts.nodeEnv] - process.env.NODE_ENV 값.
 * @param {string} [opts.seedConfirm] - process.env.SEED_CONFIRM 값.
 * @returns {boolean} seed 실행 허용 여부.
 */
export const shouldAllowSeed = ({ nodeEnv, seedConfirm } = {}) => {
  if (nodeEnv === 'production' && seedConfirm !== 'YES') return false;
  return true;
};

// `prisma db seed` 진입 시에만 실행 (테스트에서 import 시 자동 실행/Prisma 연결 방지).
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;

if (isDirectRun) {
  // dotenv / PrismaClient 는 실제 실행 시점에만 로드 (테스트 import 시 의존성 회피).
  await import('dotenv/config');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const main = async () => {
    if (
      !shouldAllowSeed({ nodeEnv: process.env.NODE_ENV, seedConfirm: process.env.SEED_CONFIRM })
    ) {
      throw new Error('seed aborted: NODE_ENV=production. SEED_CONFIRM=YES 를 명시해야 실행 가능.');
    }
    console.log(`seeding letter-api dev messages...`);
    // deleteMany + createMany 를 트랜잭션으로 묶어 원자성 보장.
    // (createMany 실패 시 deleteMany 도 롤백되어 테이블이 빈 상태로 남지 않는다.)
    await prisma.$transaction([
      prisma.message.deleteMany({}),
      prisma.message.createMany({ data: SEED_MESSAGES }),
    ]);
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
}
