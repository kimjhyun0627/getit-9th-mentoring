/**
 * Vitest 셋업 — 환경 변수 + Prisma 인메모리 모킹.
 *
 * 실 MySQL 없이 supertest로 라우터 e2e 테스트가 돌도록,
 * `src/lib/prisma.js` 가 노출하는 PrismaClient를 가짜 in-memory 구현으로 대체.
 *
 * 각 테스트 파일이 `beforeEach`에서 `resetDb()` 호출해 상태 초기화.
 */
import { beforeEach, vi } from 'vitest';

// 테스트용 환경 변수 (실 .env 안 건드림)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.BCRYPT_COST = '4'; // 테스트 속도 (실 운영은 12)
process.env.COOKIE_DOMAIN = '';
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.PORT = '0';

/** @type {{ users: Map<string, any>, refreshTokens: Map<string, any> }} */
export const memDb = {
  users: new Map(),
  refreshTokens: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

/** 모든 in-memory 상태 + ID 카운터 리셋 */
export const resetDb = () => {
  memDb.users.clear();
  memDb.refreshTokens.clear();
  idCounter = 0;
};

/** Prisma where 클로즈를 in-memory Map에 적용 */
const matchWhere = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => row[k] === v);
};

class FakePrismaClient {
  constructor() {
    this.user = {
      findUnique: async ({ where }) => {
        for (const u of memDb.users.values()) if (matchWhere(u, where)) return { ...u };
        return null;
      },
      create: async ({ data }) => {
        const id = nextId('u');
        const now = new Date();
        const row = { id, ...data, createdAt: now, updatedAt: now };
        memDb.users.set(id, row);
        return { ...row };
      },
    };

    this.refreshToken = {
      create: async ({ data }) => {
        const id = nextId('rt');
        const row = { id, revokedAt: null, createdAt: new Date(), ...data };
        memDb.refreshTokens.set(id, row);
        return { ...row };
      },
      findUnique: async ({ where }) => {
        for (const t of memDb.refreshTokens.values()) if (matchWhere(t, where)) return { ...t };
        return null;
      },
      update: async ({ where, data }) => {
        for (const [id, t] of memDb.refreshTokens) {
          if (matchWhere(t, where)) {
            const updated = { ...t, ...data };
            memDb.refreshTokens.set(id, updated);
            return { ...updated };
          }
        }
        throw new Error('RefreshToken not found');
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, t] of memDb.refreshTokens) {
          if (matchWhere(t, where)) {
            memDb.refreshTokens.set(id, { ...t, ...data });
            count++;
          }
        }
        return { count };
      },
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async $disconnect() {
    /* no-op */
  }
}

// `src/lib/prisma.js`가 export하는 prisma 싱글톤을 fake로 치환
vi.mock('../src/lib/prisma.js', () => {
  return { prisma: new FakePrismaClient() };
});

beforeEach(() => {
  resetDb();
});
