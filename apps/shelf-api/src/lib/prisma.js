/**
 * PrismaClient 싱글톤.
 *
 * - 테스트에서는 setup이 이 모듈을 `vi.mock` 해서 in-memory fake로 치환.
 * - 운영에서는 매 import 마다 같은 client 인스턴스를 공유.
 * - 개발 환경(`node --watch`)에서 hot-reload 시 connection leak 방지 위해
 *   `globalThis` 캐싱 패턴 사용. production에서는 한 번만 생성.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}
