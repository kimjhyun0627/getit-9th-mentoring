/**
 * Prisma seed CLI 진입점.
 *
 * 분리 이유: `seed.js` 는 helper 만 export 하는 순수 모듈 (테스트가 fake prisma 로
 * 호출). 본 파일이 @prisma/client 를 실제로 import 해서 CLI 실행만 담당 —
 * 이렇게 분리해야 vitest 가 seed.js 를 transform 할 때 @prisma/client 미생성
 * 상태에서도 안전.
 *
 * 실행: `pnpm --filter @getit/hobby-api prisma:seed`
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { main } from './seed.js';

const prisma = new PrismaClient();

void main(prisma)
  .catch((err) => {
    console.error('seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
