/**
 * PrismaClient 싱글톤.
 *
 * - dev 핫리로드 시 모듈이 여러 번 평가돼도 client 1개만 유지 (globalThis 캐시).
 * - prod 에서는 globalThis 캐시에 안 꽂아 메모리 누수 회피.
 * - log 설정: dev = query/error/warn, prod = error 만.
 * - 테스트에서는 `tests/setup.js` 가 이 모듈을 `vi.mock` 해 in-memory fake로 치환.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
