/**
 * PrismaClient 싱글톤 (globalThis 캐싱).
 *
 * - 운영: 매 import 마다 같은 client 인스턴스를 공유.
 * - 개발/테스트: hot reload·모듈 재실행으로 인한 중복 인스턴스 방지를
 *   위해 Prisma 공식 가이드대로 globalThis 캐시 사용.
 *   https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
 * - 테스트에서는 setup 에서 이 모듈을 mock 처리 가능.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__getitHobbyPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__getitHobbyPrisma = prisma;
}
