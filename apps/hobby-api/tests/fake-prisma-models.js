/**
 * FakePrisma 모델 팩토리들 — Tag / Post / PostTag / Application / Notification.
 *
 * fake-prisma.js 가 size cap (300 라인) 안에 들어가도록 분리.
 * 각 모델은 라우터에서 쓰는 Prisma API 만 흉내. 추가 패턴 필요 시 여기서 확장.
 */
import { applyAtomicUpdate, expandTagsOnPost, matchWhere } from './fake-prisma-helpers.js';

const orderRows = (rows, orderBy) => {
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
  return rows;
};

const pageSlice = (rows, { take, cursor, skip }) => {
  let out = rows;
  if (cursor) {
    const idx = out.findIndex((n) => n.id === cursor.id);
    if (idx < 0) return [];
    out = out.slice(idx + (skip ?? 0));
  }
  if (typeof take === 'number') out = out.slice(0, take);
  return out;
};

export const buildTagModel = (memDb, nextId) => ({
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

/**
 * PostTag 모델 (다대다 조인). 라우터에서 쓰는 패턴만 구현.
 */
export const buildPostTagModel = (memDb) => ({
  create: async ({ data }) => {
    const key = `${data.postId}::${data.tagId}`;
    const row = { postId: data.postId, tagId: data.tagId };
    memDb.postTags.set(key, row);
    return { ...row };
  },
  deleteMany: async ({ where }) => {
    let count = 0;
    for (const [key, row] of [...memDb.postTags]) {
      if (matchWhere(row, where ?? {})) {
        memDb.postTags.delete(key);
        count += 1;
      }
    }
    return { count };
  },
  findMany: async ({ where } = {}) => {
    return [...memDb.postTags.values()].filter((r) => matchWhere(r, where ?? {}));
  },
});

const linkTags = (memDb, nextId, postId, tagsBlock) => {
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

export const buildPostModel = (memDb, nextId) => ({
  create: async ({ data, include }) => {
    const id = data.id ?? nextId('post');
    const now = new Date();
    const { tags: tagsBlock, ...postFields } = data;
    const row = {
      id,
      status: 'RECRUITING',
      currentCapacity: 0,
      // #500: schema.prisma 의 default(FIRST_COME) 와 동일.
      applicationPolicy: 'FIRST_COME',
      createdAt: now,
      updatedAt: now,
      ...postFields,
    };
    memDb.posts.set(id, row);
    linkTags(memDb, nextId, id, tagsBlock);
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

    rows = orderRows(rows, orderBy);
    rows = pageSlice(rows, { take, cursor, skip });
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

export const buildApplicationModel = (memDb, nextId) => ({
  create: async ({ data }) => {
    for (const a of memDb.applications.values()) {
      if (a.postId === data.postId && a.userId === data.userId) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
    }
    const id = data.id ?? nextId('app');
    // schema.prisma 의 default(false) 와 동일하게 noShow 초기값 보장.
    // #500: status 도 schema default 와 동일하게 APPROVED 로 초기화 (data.status 가 우선).
    const row = { id, createdAt: new Date(), noShow: false, status: 'APPROVED', ...data };
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

  findMany: async ({ where, select } = {}) => {
    const rows = [...memDb.applications.values()].filter((a) => matchWhere(a, where));
    if (!select) return rows.map((a) => ({ ...a }));
    return rows.map((a) => {
      const picked = {};
      for (const k of Object.keys(select)) if (select[k]) picked[k] = a[k];
      return picked;
    });
  },

  updateMany: async ({ where, data }) => {
    let count = 0;
    for (const [id, a] of memDb.applications) {
      if (matchWhere(a, where ?? {})) {
        memDb.applications.set(id, { ...a, ...data });
        count += 1;
      }
    }
    return { count };
  },

  // #500: approve/reject 결정 — 단건 update.
  update: async ({ where, data }) => {
    for (const [id, a] of memDb.applications) {
      if (matchWhere(a, where)) {
        const next = { ...a, ...data };
        memDb.applications.set(id, next);
        return { ...next };
      }
    }
    const err = new Error('Record to update not found');
    err.code = 'P2025';
    throw err;
  },

  // #500/Gemini PR #510: count — Post detail 의 applicationCount 채우는데 사용.
  count: async ({ where } = {}) => {
    let n = 0;
    for (const a of memDb.applications.values()) {
      if (matchWhere(a, where ?? {})) n += 1;
    }
    return n;
  },
});

export const buildNotificationModel = (memDb, nextId) => ({
  findUnique: async ({ where }) => {
    for (const n of memDb.notifications.values()) {
      if (matchWhere(n, where)) return { ...n };
    }
    return null;
  },

  create: async ({ data }) => {
    const id = data.id ?? nextId('notif');
    const row = { id, createdAt: new Date(), readAt: null, postId: null, ...data };
    memDb.notifications.set(id, row);
    return { ...row };
  },

  createMany: async ({ data }) => {
    const rows = Array.isArray(data) ? data : [data];
    for (const d of rows) {
      const id = d.id ?? nextId('notif');
      memDb.notifications.set(id, {
        id,
        createdAt: new Date(),
        readAt: null,
        postId: null,
        ...d,
      });
    }
    return { count: rows.length };
  },

  findMany: async ({ where, orderBy, take, cursor, skip } = {}) => {
    let rows = [...memDb.notifications.values()].filter((n) => matchWhere(n, where ?? {}));
    rows = orderRows(rows, orderBy);
    rows = pageSlice(rows, { take, cursor, skip });
    return rows.map((n) => ({ ...n }));
  },

  updateMany: async ({ where, data }) => {
    let count = 0;
    for (const [id, n] of memDb.notifications) {
      if (matchWhere(n, where ?? {})) {
        memDb.notifications.set(id, { ...n, ...data });
        count += 1;
      }
    }
    return { count };
  },

  count: async ({ where } = {}) => {
    let n = 0;
    for (const row of memDb.notifications.values()) {
      if (matchWhere(row, where ?? {})) n += 1;
    }
    return n;
  },
});
