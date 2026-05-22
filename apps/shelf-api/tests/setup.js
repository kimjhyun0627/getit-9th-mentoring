/**
 * Vitest 셋업 — 환경 변수 + Prisma 인메모리 모킹 + 외부 HTTP undici MockAgent.
 *
 * 실 MySQL/카카오 API 없이 supertest로 라우터 e2e 테스트가 돌도록,
 * `src/lib/prisma.js` 가 노출하는 PrismaClient를 가짜 in-memory 구현으로 대체.
 * 카카오 도서 API 호출(Node 내장 fetch == undici) 은 undici MockAgent 로 가로채서
 * 테스트별 fixture 응답을 돌려준다.
 *
 * 각 테스트 파일이 `beforeEach`에서 `resetDb()` 호출해 상태 초기화.
 */
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { beforeEach, afterEach, vi } from 'vitest';

// 테스트용 환경 변수 (실 .env 안 건드림)
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.KAKAO_BOOK_API_KEY = 'test-kakao-key';
process.env.BOOK_CACHE_TTL_HOURS = '24';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';

/** @type {{ books: Map<string, any>, bookShelves: Map<string, any> }} */
export const memDb = {
  books: new Map(),
  bookShelves: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

/** 모든 in-memory 상태 + ID 카운터 리셋 */
export const resetDb = () => {
  memDb.books.clear();
  memDb.bookShelves.clear();
  idCounter = 0;
};

/** Prisma `P2002` 흉내 (unique constraint violation). */
export class PrismaUniqueViolation extends Error {
  constructor(target) {
    super(`Unique constraint failed on the fields: ${target}`);
    this.name = 'PrismaClientKnownRequestError';
    this.code = 'P2002';
    this.meta = { target };
  }
}

/**
 * Prisma where 절을 in-memory Map row 에 적용.
 * `{ gt, gte, lt, lte, equals, in }` + 복합 unique 키 `userId_bookId` 일부 지원.
 *
 * @param {Record<string, any>} row
 * @param {Record<string, any> | undefined} where
 * @returns {boolean}
 */
const matchWhere = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    // 복합 unique key — Prisma `{ userId, bookId }` 형태
    if (k === 'userId_bookId' && v && typeof v === 'object') {
      return row.userId === v.userId && row.bookId === v.bookId;
    }
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      // 같은 필드에 여러 연산자가 있을 수 있음 (예: {age: {gte:18, lte:65}}).
      const checks = [];
      if ('equals' in v) checks.push(row[k] === v.equals);
      if ('gt' in v) checks.push(row[k] > v.gt);
      if ('gte' in v) checks.push(row[k] >= v.gte);
      if ('lt' in v) checks.push(row[k] < v.lt);
      if ('lte' in v) checks.push(row[k] <= v.lte);
      if ('in' in v) checks.push(v.in.includes(row[k]));
      if ('not' in v) checks.push(row[k] !== v.not);
      return checks.length > 0 ? checks.every((c) => c) : false;
    }
    return row[k] === v;
  });
};

const makeBookDelegate = () => ({
  findUnique: async ({ where }) => {
    for (const b of memDb.books.values()) {
      if (matchWhere(b, where)) return { ...b };
    }
    return null;
  },
  upsert: async ({ where, create, update }) => {
    for (const [id, b] of memDb.books) {
      if (matchWhere(b, where)) {
        const updated = { ...b, ...update, cachedAt: new Date() };
        memDb.books.set(id, updated);
        return { ...updated };
      }
    }
    const id = nextId('b');
    const now = new Date();
    const row = { id, ...create, cachedAt: now };
    memDb.books.set(id, row);
    return { ...row };
  },
  findMany: async ({ where, take, orderBy } = {}) => {
    const all = [...memDb.books.values()].filter((b) => matchWhere(b, where));
    if (orderBy?.cachedAt === 'desc') all.sort((a, b) => b.cachedAt - a.cachedAt);
    return take ? all.slice(0, take).map((b) => ({ ...b })) : all.map((b) => ({ ...b }));
  },
});

const makeBookShelfDelegate = () => ({
  create: async ({ data, include }) => {
    for (const r of memDb.bookShelves.values()) {
      if (r.userId === data.userId && r.bookId === data.bookId) {
        throw new PrismaUniqueViolation(['userId', 'bookId']);
      }
    }
    const id = nextId('bs');
    const row = {
      id,
      rating: null,
      review: null,
      completedAt: null,
      addedAt: new Date(),
      userNickname: null,
      ...data,
    };
    memDb.bookShelves.set(id, row);
    return include?.book ? { ...row, book: { ...memDb.books.get(row.bookId) } } : { ...row };
  },
  findUnique: async ({ where, include }) => {
    for (const r of memDb.bookShelves.values()) {
      if (matchWhere(r, where)) {
        return include?.book
          ? { ...r, book: memDb.books.get(r.bookId) ? { ...memDb.books.get(r.bookId) } : null }
          : { ...r };
      }
    }
    return null;
  },
  findFirst: async ({ where, include } = {}) => {
    for (const r of memDb.bookShelves.values()) {
      if (matchWhere(r, where)) {
        return include?.book
          ? { ...r, book: memDb.books.get(r.bookId) ? { ...memDb.books.get(r.bookId) } : null }
          : { ...r };
      }
    }
    return null;
  },
  findMany: async ({ where, orderBy, include, skip, take } = {}) => {
    const list = [...memDb.bookShelves.values()].filter((r) => matchWhere(r, where));
    if (orderBy?.addedAt === 'desc') list.sort((a, b) => b.addedAt - a.addedAt);
    if (orderBy?.addedAt === 'asc') list.sort((a, b) => a.addedAt - b.addedAt);
    const sliced = skip || take ? list.slice(skip ?? 0, (skip ?? 0) + (take ?? list.length)) : list;
    return sliced.map((r) =>
      include?.book
        ? { ...r, book: memDb.books.get(r.bookId) ? { ...memDb.books.get(r.bookId) } : null }
        : { ...r },
    );
  },
  count: async ({ where } = {}) =>
    [...memDb.bookShelves.values()].filter((r) => matchWhere(r, where)).length,
  update: async ({ where, data, include }) => {
    for (const [id, r] of memDb.bookShelves) {
      if (matchWhere(r, where)) {
        const updated = { ...r, ...data };
        memDb.bookShelves.set(id, updated);
        return include?.book
          ? { ...updated, book: { ...memDb.books.get(updated.bookId) } }
          : { ...updated };
      }
    }
    throw new Error('BookShelf not found');
  },
  delete: async ({ where }) => {
    for (const [id, r] of memDb.bookShelves) {
      if (matchWhere(r, where)) {
        memDb.bookShelves.delete(id);
        return { ...r };
      }
    }
    throw new Error('BookShelf not found');
  },
});

class FakePrismaClient {
  constructor() {
    this.book = makeBookDelegate();
    this.bookShelf = makeBookShelfDelegate();
  }

  async $transaction(fn) {
    if (Array.isArray(fn)) return Promise.all(fn);
    return fn(this);
  }

  async $disconnect() {
    /* no-op */
  }
}

// `src/lib/prisma.js`가 export하는 prisma 싱글톤을 fake로 치환
vi.mock('../src/lib/prisma.js', () => {
  return { prisma: new FakePrismaClient() };
});

/** @type {MockAgent | null} */
let mockAgent = null;
/** @type {import('undici').Dispatcher | null} */
let originalDispatcher = null;

/**
 * 현재 활성 MockAgent — kakao 응답 stub 등록용.
 *
 * @returns {import('undici').MockPool}
 */
export const mockKakaoPool = () => {
  if (!mockAgent) throw new Error('MockAgent not initialized (beforeEach 누락?)');
  return mockAgent.get('https://dapi.kakao.com');
};

beforeEach(() => {
  resetDb();
  // 외부 HTTP 차단 — 등록 안 된 호출은 throw.
  originalDispatcher = getGlobalDispatcher();
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  if (mockAgent) {
    await mockAgent.close();
    mockAgent = null;
  }
  if (originalDispatcher) {
    setGlobalDispatcher(originalDispatcher);
    originalDispatcher = null;
  }
});
