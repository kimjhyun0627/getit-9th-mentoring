/**
 * PrismaClient 싱글톤.
 *
 * - 테스트에서는 setup이 이 모듈을 `vi.mock` 해서 in-memory fake로 치환.
 * - 운영에서는 매 import 마다 같은 client 인스턴스를 공유.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
