/**
 * letter-api 테스트 셋업 — env + 인메모리 Prisma 모킹.
 *
 * auth-api / hobby-api 패턴 따라 `src/lib/prisma.js` 를 vi.mock 으로
 * in-memory 구현으로 치환. 실 MySQL 없이 supertest e2e 가 동작.
 *
 * 모델: Message (단일). where 절은 라우터가 쓰는 패턴만 흉내.
 */
import { beforeEach, vi } from 'vitest';

// 테스트용 env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.PORT = '0';

/** @type {{ messages: Map<string, any> }} */
export const memDb = {
  messages: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

export const resetDb = () => {
  memDb.messages.clear();
  idCounter = 0;
};

/**
 * Prisma where 절을 in-memory row 에 적용. 라우터가 쓰는 연산자만 지원.
 */
const matchWhere = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('equals' in v) return row[k] === v.equals;
      if ('gt' in v) return row[k] > v.gt;
      if ('lt' in v) return row[k] < v.lt;
      if ('in' in v) return Array.isArray(v.in) && v.in.includes(row[k]);
      return false;
    }
    return row[k] === v;
  });
};

class FakePrismaClient {
  constructor() {
    this.message = {
      create: async ({ data }) => {
        const id = data.id ?? nextId('msg');
        const now = new Date();
        const row = { id, createdAt: now, updatedAt: now, ...data };
        memDb.messages.set(id, row);
        return { ...row };
      },

      findMany: async ({ where, orderBy } = {}) => {
        let rows = [...memDb.messages.values()].filter((m) => matchWhere(m, where));
        const order = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        rows.sort((a, b) => {
          for (const ob of order) {
            const [k, dir] = Object.entries(ob)[0];
            if (a[k] === b[k]) continue;
            const cmp = a[k] > b[k] ? 1 : -1;
            return dir === 'desc' ? -cmp : cmp;
          }
          return 0;
        });
        return rows.map((r) => ({ ...r }));
      },

      findUnique: async ({ where, select }) => {
        for (const m of memDb.messages.values()) {
          if (matchWhere(m, where)) {
            if (select) {
              const picked = {};
              for (const k of Object.keys(select)) if (select[k]) picked[k] = m[k];
              return picked;
            }
            return { ...m };
          }
        }
        return null;
      },

      // 라우터의 TOCTOU 회피 (id + authorId 동시 조건) 흉내.
      deleteMany: async ({ where }) => {
        let count = 0;
        for (const [id, m] of [...memDb.messages]) {
          if (matchWhere(m, where)) {
            memDb.messages.delete(id);
            count += 1;
          }
        }
        return { count };
      },

      // PATCH 도 deleteMany 동일하게 (id + authorId) 조건 갱신.
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const [id, m] of memDb.messages) {
          if (matchWhere(m, where)) {
            memDb.messages.set(id, { ...m, ...data, updatedAt: new Date() });
            count += 1;
          }
        }
        return { count };
      },
    };
  }

  async $transaction(fn) {
    if (Array.isArray(fn)) return Promise.all(fn);
    return fn(this);
  }

  // eslint-disable-next-line class-methods-use-this
  async $disconnect() {}
}

vi.mock('../src/lib/prisma.js', () => {
  return { prisma: new FakePrismaClient() };
});

beforeEach(() => {
  resetDb();
});
