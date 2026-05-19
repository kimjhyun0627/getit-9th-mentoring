/**
 * Prisma seed — 개발/테스트용 더미 유저.
 *
 * 멱등성: upsert로 처리. 같은 email이면 비밀번호 해시만 갱신.
 * bcrypt cost: 12 (BE 검증/회원가입 흐름과 일치).
 *
 * 실행: `pnpm --filter @getit/auth-api prisma:seed`
 *       또는 `pnpm --filter @getit/auth-api exec prisma db seed`
 */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BCRYPT_COST = Number.parseInt(process.env.BCRYPT_COST || '12', 10);

const SEED_USERS = [
  { email: 'alice@get-it.cloud', name: 'Alice', password: 'password1234' },
  { email: 'bob@get-it.cloud', name: 'Bob', password: 'password1234' },
];

const prisma = new PrismaClient();

const seedUser = async ({ email, name, password }) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, name, passwordHash },
  });
  console.log(`  seeded: ${user.email} (id=${user.id})`);
  return user;
};

const main = async () => {
  console.log(`seeding auth-api dev users (bcrypt cost=${BCRYPT_COST})...`);
  for (const u of SEED_USERS) {
    await seedUser(u);
  }
  console.log(`done. seeded ${SEED_USERS.length} users.`);
};

main()
  .catch((err) => {
    console.error('seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
