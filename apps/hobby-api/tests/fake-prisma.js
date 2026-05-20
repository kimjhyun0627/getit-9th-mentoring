/**
 * hobby-api 테스트용 in-memory PrismaClient.
 *
 * 실 MySQL 없이 supertest e2e 가 돌아가도록 라우터에서 쓰는 Prisma 패턴만 흉내냄.
 *
 * 지원 모델: Tag / Post / PostTag / Application.
 * $transaction 은 FIFO mutex 로 직렬화 — MySQL InnoDB row-lock 흉내. 동시 호출이
 * 큐를 타야 race condition 테스트가 의미가 있음 (async/await 만 쓰면 interleave 돼서
 * lost-update 가 silent 통과).
 */
import { applyAtomicUpdate, expandTagsOnPost, matchWhere } from './fake-prisma-helpers.js';

/**
 * @type {{
 *   tags: Map<string, any>,
 *   posts: Map<string, any>,
 *   postTags: Map<string, any>,
 *   applications: Map<string, any>,
 * }}
 */
export const memDb = {
  tags: new Map(),
  posts: new Map(),
  postTags: new Map(),
  applications: new Map(),
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

export const resetDb = () => {
  memDb.tags.clear();
  memDb.posts.clear();
  memDb.postTags.clear();
  memDb.applications.clear();
  idCounter = 0;
};

const buildTagModel = () => ({
  upsert: async ({ where, update: _update, create }) => {
    for (const t of memDb.tags.values()) {
      if (t.name === where.name) return { ...t };
    }
    const id = create.id ?? nextId('tag');
    const row = { ...create, id };
    memDb.tags.set(id, row);
    return { ...row };
  },
  findUnique: async ({ where }) => {
    for (const t of memDb.tags.values()) if (matchWhere(t, where)) return { ...t };
    return null;
  },
});

const linkTags = (postId, tagsBlock) => {
  if (!tagsBlock?.create) return;
  for (const link of tagsBlock.create) {
    const coc = link.tag?.connectOrCreate;
    if (!coc) continue;
    let tag = [...memDb.tags.values()].find((t) => t.name === coc.where.name);
    if (!tag) {
      const tid = coc.create.id ?? nextId('tag');
      tag = { id: tid, name: coc.create.name };
      memDb.tags.set(tid, tag);
    }
    memDb.postTags.set(`${postId}::${tag.id}`, { postId, tagId: tag.id });
  }
};

const buildPostModel = () => ({
  create: async ({ data, include }) => {
    const id = data.id ?? nextId('post');
    const now = new Date();
    const { tags: tagsBlock, ...postFields } = data;
    const row = {
      id,
      status: 'RECRUITING',
      currentCapacity: 0,
      createdAt: now,
      updatedAt: now,
      ...postFields,
    };
    memDb.posts.set(id, row);
    linkTags(id, tagsBlock);
    return include?.tags ? expandTagsOnPost(memDb, { ...row }) : { ...row };
  },

  findUnique: async ({ where, include, select }) => {
    for (const p of memDb.posts.values()) {
      if (matchWhere(p, where)) {
        const base = include?.tags ? expandTagsOnPost(memDb, { ...p }) : { ...p };
        if (select) {
          const picked = {};
          for (const k of Object.keys(select)) if (select[k]) picked[k] = base[k];
          return picked;
        }
        return base;
      }
    }
    return null;
  },

  findMany: async ({ where, include, orderBy, take, cursor, skip }) => {
    const { tags: tagsFilter, ...restWhere } = where ?? {};
    let rows = [...memDb.posts.values()].filter((p) => matchWhere(p, restWhere));

    const tagFilter = tagsFilter?.some?.tag?.name;
    if (tagFilter) {
      rows = rows.filter((p) =>
        [...memDb.postTags.values()].some(
          (pt) => pt.postId === p.id && memDb.tags.get(pt.tagId)?.name === tagFilter,
        ),
      );
    }

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

    if (cursor) {
      const idx = rows.findIndex((p) => p.id === cursor.id);
      // cursor 미스 → 빈 결과 (페이지네이션 버그 silent 통과 방지).
      if (idx < 0) return [];
      rows = rows.slice(idx + (skip ?? 0));
    }
    if (typeof take === 'number') rows = rows.slice(0, take);

    return rows.map((p) => (include?.tags ? expandTagsOnPost(memDb, p) : { ...p }));
  },

  delete: async ({ where }) => {
    for (const [id, p] of memDb.posts) {
      if (matchWhere(p, where)) {
        memDb.posts.delete(id);
        for (const key of [...memDb.postTags.keys()]) {
          if (memDb.postTags.get(key).postId === id) memDb.postTags.delete(key);
        }
        return { ...p };
      }
    }
    const err = new Error('Record to delete does not exist');
    err.code = 'P2025';
    throw err;
  },

  deleteMany: async ({ where }) => {
    let count = 0;
    for (const [id, p] of [...memDb.posts]) {
      if (matchWhere(p, where)) {
        memDb.posts.delete(id);
        for (const key of [...memDb.postTags.keys()]) {
          if (memDb.postTags.get(key).postId === id) memDb.postTags.delete(key);
        }
        count += 1;
      }
    }
    return { count };
  },

  update: async ({ where, data }) => {
    for (const [id, p] of memDb.posts) {
      if (matchWhere(p, where)) {
        const next = applyAtomicUpdate(p, data);
        memDb.posts.set(id, next);
        return { ...next };
      }
    }
    const err = new Error('Record to update not found');
    err.code = 'P2025';
    throw err;
  },

  // race-safe 좌석 확보 핵심. 조건부 increment/decrement 를 atomic 처럼 처리.
  updateMany: async ({ where, data }) => {
    let count = 0;
    for (const [id, p] of memDb.posts) {
      if (matchWhere(p, where)) {
        memDb.posts.set(id, applyAtomicUpdate(p, data));
        count += 1;
      }
    }
    return { count };
  },
});

const buildApplicationModel = () => ({
  create: async ({ data }) => {
    for (const a of memDb.applications.values()) {
      if (a.postId === data.postId && a.userId === data.userId) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
    }
    const id = data.id ?? nextId('app');
    const row = { id, createdAt: new Date(), ...data };
    memDb.applications.set(id, row);
    return { ...row };
  },

  findUnique: async ({ where }) => {
    // 복합 unique 인덱스 키 (postId_userId) 지원.
    if (where.postId_userId) {
      const { postId, userId } = where.postId_userId;
      for (const a of memDb.applications.values()) {
        if (a.postId === postId && a.userId === userId) return { ...a };
      }
      return null;
    }
    for (const a of memDb.applications.values()) {
      if (matchWhere(a, where)) return { ...a };
    }
    return null;
  },

  delete: async ({ where }) => {
    for (const [id, a] of memDb.applications) {
      if (matchWhere(a, where)) {
        memDb.applications.delete(id);
        return { ...a };
      }
    }
    const err = new Error('Record to delete does not exist');
    err.code = 'P2025';
    throw err;
  },
});

// $transaction 직렬화용 module-level queue (FIFO mutex).
let txQueue = Promise.resolve();

export class FakePrismaClient {
  constructor() {
    this.tag = buildTagModel();
    this.post = buildPostModel();
    this.application = buildApplicationModel();
  }

  /**
   * 트랜잭션 직렬화 — MySQL InnoDB row-lock 흉내.
   * 단순 `fn(this)` 만 호출하면 await 경계에서 interleave 돼 race condition 테스트
   * 의미가 사라짐. FIFO 큐로 한 번에 하나만 실행 → 동시 신청 race 정확히 시뮬레이트.
   */
  async $transaction(fn) {
    if (Array.isArray(fn)) return Promise.all(fn);
    const prev = txQueue;
    let release;
    txQueue = new Promise((r) => {
      release = r;
    });
    try {
      await prev;
      return await fn(this);
    } finally {
      release();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async $disconnect() {}
}
