/**
 * PrismaClient 싱글톤 (board-api).
 *
 * - 후속 BE PR (#46/#47/#48) 의 route handler 가 import 해서 사용.
 * - 테스트에서는 setup 이 이 모듈을 vi.mock 으로 치환.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
