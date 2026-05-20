/**
 * Vitest 셋업 — 환경 변수 + Prisma 인메모리 모킹 (board-api).
 *
 * 실 MySQL 없이 supertest로 라우터 e2e 테스트가 돌도록,
 * `src/lib/prisma.js` 가 노출하는 PrismaClient를 가짜 in-memory 구현으로 대체.
 *
 * 각 테스트 파일이 `beforeEach`에서 `resetDb()` 호출해 상태 초기화.
 */
import { beforeEach, vi } from 'vitest';

import { compareBy, makeMatchWhere, PrismaUniqueViolation } from './fake-prisma-utils.js';

// 테스트용 환경 변수 (실 .env 안 건드림)
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.PORT = '0';

/**
 * 메모리 DB. 각 컬렉션은 Map<id, row>.
 *
 * @type {{
 *   projects: Map<string, any>,
 *   projectMembers: Map<string, any>,
 *   boardColumns: Map<string, any>,
 *   cards: Map<string, any>,
 * }}
 */
export const memDb = {
  projects: new Map(),
  projectMembers: new Map(),
  boardColumns: new Map(),
  cards: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

/** 모든 in-memory 상태 + ID 카운터 리셋 */
export const resetDb = () => {
  memDb.projects.clear();
  memDb.projectMembers.clear();
  memDb.boardColumns.clear();
  memDb.cards.clear();
  idCounter = 0;
};

const matchWhere = makeMatchWhere(memDb);

const makeProjectDelegate = () => ({
  create: async ({ data }) => {
    const id = nextId('p');
    const now = new Date();
    const row = { id, description: null, ...data, createdAt: now, updatedAt: now };
    memDb.projects.set(id, row);
    return { ...row };
  },
  findUnique: async ({ where }) => {
    for (const r of memDb.projects.values()) if (matchWhere(r, where)) return { ...r };
    return null;
  },
  findMany: async ({ where, orderBy } = {}) => {
    let list = [...memDb.projects.values()];
    if (where) list = list.filter((r) => matchWhere(r, where));
    if (orderBy?.createdAt) {
      list.sort((a, b) =>
        orderBy.createdAt === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      );
    }
    return list.map((r) => ({ ...r }));
  },
  update: async ({ where, data }) => {
    for (const [id, r] of memDb.projects) {
      if (matchWhere(r, where)) {
        const updated = { ...r, ...data, updatedAt: new Date() };
        memDb.projects.set(id, updated);
        return { ...updated };
      }
    }
    throw new Error('Project not found');
  },
  delete: async ({ where }) => {
    for (const [id, r] of memDb.projects) {
      if (matchWhere(r, where)) {
        memDb.projects.delete(id);
        // cascade: members + columns + cards in columns
        for (const [mid, m] of memDb.projectMembers) {
          if (m.projectId === id) memDb.projectMembers.delete(mid);
        }
        const colIds = new Set();
        for (const [cid, c] of memDb.boardColumns) {
          if (c.projectId === id) {
            colIds.add(cid);
            memDb.boardColumns.delete(cid);
          }
        }
        for (const [cardId, card] of memDb.cards) {
          if (colIds.has(card.columnId)) memDb.cards.delete(cardId);
        }
        return { ...r };
      }
    }
    throw new Error('Project not found');
  },
});

const makeProjectMemberDelegate = () => ({
  create: async ({ data }) => {
    for (const m of memDb.projectMembers.values()) {
      if (m.projectId === data.projectId && m.userId === data.userId) {
        throw new PrismaUniqueViolation(['projectId', 'userId']);
      }
    }
    const id = nextId('pm');
    const row = { id, role: 'MEMBER', joinedAt: new Date(), ...data };
    memDb.projectMembers.set(id, row);
    return { ...row };
  },
  findUnique: async ({ where }) => {
    for (const m of memDb.projectMembers.values()) if (matchWhere(m, where)) return { ...m };
    return null;
  },
  findFirst: async ({ where }) => {
    for (const m of memDb.projectMembers.values()) if (matchWhere(m, where)) return { ...m };
    return null;
  },
  findMany: async ({ where } = {}) => {
    let list = [...memDb.projectMembers.values()];
    if (where) list = list.filter((m) => matchWhere(m, where));
    return list.map((m) => ({ ...m }));
  },
  delete: async ({ where }) => {
    for (const [id, m] of memDb.projectMembers) {
      if (matchWhere(m, where)) {
        memDb.projectMembers.delete(id);
        return { ...m };
      }
    }
    throw new Error('ProjectMember not found');
  },
  deleteMany: async ({ where } = {}) => {
    let count = 0;
    for (const [id, m] of memDb.projectMembers) {
      if (matchWhere(m, where)) {
        memDb.projectMembers.delete(id);
        count++;
      }
    }
    return { count };
  },
});

const makeBoardColumnDelegate = () => ({
  create: async ({ data }) => {
    const id = nextId('col');
    const row = { id, ...data };
    memDb.boardColumns.set(id, row);
    return { ...row };
  },
  createMany: async ({ data }) => {
    for (const d of data) {
      const id = nextId('col');
      memDb.boardColumns.set(id, { id, ...d });
    }
    return { count: data.length };
  },
  findUnique: async ({ where }) => {
    for (const c of memDb.boardColumns.values()) if (matchWhere(c, where)) return { ...c };
    return null;
  },
  findFirst: async ({ where, orderBy } = {}) => {
    let list = [...memDb.boardColumns.values()];
    if (where) list = list.filter((c) => matchWhere(c, where));
    if (orderBy) list.sort(compareBy(orderBy));
    return list.length ? { ...list[0] } : null;
  },
  findMany: async ({ where, orderBy } = {}) => {
    let list = [...memDb.boardColumns.values()];
    if (where) list = list.filter((c) => matchWhere(c, where));
    if (orderBy) list.sort(compareBy(orderBy));
    return list.map((c) => ({ ...c }));
  },
  count: async ({ where } = {}) => {
    let n = 0;
    for (const c of memDb.boardColumns.values()) if (matchWhere(c, where)) n++;
    return n;
  },
  update: async ({ where, data }) => {
    for (const [id, c] of memDb.boardColumns) {
      if (matchWhere(c, where)) {
        const updated = { ...c, ...data };
        memDb.boardColumns.set(id, updated);
        return { ...updated };
      }
    }
    throw new Error('BoardColumn not found');
  },
  delete: async ({ where }) => {
    for (const [id, c] of memDb.boardColumns) {
      if (matchWhere(c, where)) {
        memDb.boardColumns.delete(id);
        for (const [cardId, card] of memDb.cards) {
          if (card.columnId === id) memDb.cards.delete(cardId);
        }
        return { ...c };
      }
    }
    throw new Error('BoardColumn not found');
  },
});

const makeCardDelegate = () => ({
  create: async ({ data }) => {
    const id = nextId('card');
    const now = new Date();
    const row = {
      id,
      description: null,
      assigneeId: null,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    memDb.cards.set(id, row);
    return { ...row };
  },
  findUnique: async ({ where }) => {
    for (const c of memDb.cards.values()) if (matchWhere(c, where)) return { ...c };
    return null;
  },
  findFirst: async ({ where, orderBy } = {}) => {
    let list = [...memDb.cards.values()];
    if (where) list = list.filter((c) => matchWhere(c, where));
    if (orderBy) list.sort(compareBy(orderBy));
    return list.length ? { ...list[0] } : null;
  },
  findMany: async ({ where, orderBy } = {}) => {
    let list = [...memDb.cards.values()];
    if (where) list = list.filter((c) => matchWhere(c, where));
    if (orderBy) list.sort(compareBy(orderBy));
    return list.map((c) => ({ ...c }));
  },
  count: async ({ where } = {}) => {
    let n = 0;
    for (const c of memDb.cards.values()) if (matchWhere(c, where)) n++;
    return n;
  },
  update: async ({ where, data }) => {
    for (const [id, c] of memDb.cards) {
      if (matchWhere(c, where)) {
        const updated = { ...c, ...data, updatedAt: new Date() };
        memDb.cards.set(id, updated);
        return { ...updated };
      }
    }
    throw new Error('Card not found');
  },
  delete: async ({ where }) => {
    for (const [id, c] of memDb.cards) {
      if (matchWhere(c, where)) {
        memDb.cards.delete(id);
        return { ...c };
      }
    }
    throw new Error('Card not found');
  },
});

class FakePrismaClient {
  constructor() {
    this.project = makeProjectDelegate();
    this.projectMember = makeProjectMemberDelegate();
    this.boardColumn = makeBoardColumnDelegate();
    this.card = makeCardDelegate();
  }

  /**
   * interactive 형태만 지원. fake 환경이라 rollback 불가.
   *
   * @param {(tx: FakePrismaClient) => Promise<any>} fn
   * @returns {Promise<any>}
   */
  async $transaction(fn) {
    return fn(this);
  }

  async $disconnect() {
    /* no-op */
  }
}

vi.mock('../src/lib/prisma.js', () => {
  return { prisma: new FakePrismaClient() };
});

beforeEach(() => {
  resetDb();
});
