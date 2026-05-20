/**
 * hobby-api 테스트 셋업 — env + vi.mock 으로 in-memory Prisma 주입.
 *
 * 구체적인 FakePrisma 구현은 `tests/fake-prisma.js` 에 분리.
 * 새 모델/패턴이 필요하면 거기서 확장.
 */
import { beforeEach, vi } from 'vitest';

import { resetDb } from './fake-prisma.js';

// 테스트용 env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.PORT = '0';

// 다른 테스트가 `./setup.js` 에서 memDb 를 import 하던 기존 경로 유지.
export { memDb, resetDb } from './fake-prisma.js';

// vi.mock 은 파일 상단으로 hoist 됨 → 팩토리 안에서 dynamic import 로 FakePrismaClient 로드.
vi.mock('../src/lib/prisma.js', async () => {
  const { FakePrismaClient } = await import('./fake-prisma.js');
  return { prisma: new FakePrismaClient() };
});

beforeEach(() => {
  resetDb();
});
