/**
 * hobby-api 테스트 셋업 — env + 인메모리 Prisma 모킹.
 *
 * auth-api 패턴 따라 `src/lib/prisma.js` 를 vi.mock 으로 in-memory 구현으로 치환.
 * 실 MySQL 없이 supertest e2e 가 동작.
 *
 * 지원 모델: Tag / Post / PostTag (다대다 조인).
 * Prisma 사용 패턴 (라우터에서 쓰는 부분) 만 흉내냄 — 새 패턴 추가 시 여기 확장.
 */
import { beforeEach, vi } from 'vitest';

// 테스트용 env
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-min-32-chars-long-aaaaaaaaa';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.PORT = '0';

/** @type {{ tags: Map<string, any>, posts: Map<string, any>, postTags: Map<string, any> }} */
export const memDb = {
  tags: new Map(), // key=id, value={ id, name }
  posts: new Map(), // key=id, value={ id, ownerId, title, ..., createdAt }
  postTags: new Map(), // key=`${postId}::${tagId}`, value={ postId, tagId }
};

let idCounter = 0;
const nextId = (prefix) => `${prefix}_${++idCounter}`;

export const resetDb = () => {
  memDb.tags.clear();
  memDb.posts.clear();
  memDb.postTags.clear();
  idCounter = 0;
};

/**
 * Prisma where 절을 in-memory row 에 적용. 라우터에서 쓰는 연산자만 지원.
 * 지원: 단순 동등, `{ contains }`, `{ in: [...] }`, `{ lt }`, `{ gt }`.
 * AND/OR 조합은 별도 처리.
 */
const matchClause = (row, where) => {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return Array.isArray(v.in) && v.in.includes(row[k]);
      if ('contains' in v) return String(row[k] ?? '').includes(v.contains);
      if ('lt' in v) return row[k] < v.lt;
      if ('lte' in v) return row[k] <= v.lte;
      if ('gt' in v) return row[k] > v.gt;
      if ('gte' in v) return row[k] >= v.gte;
      return false;
    }
    return row[k] === v;
  });
};

const matchWhere = (row, where) => {
  if (!where) return true;
  const { AND, OR, NOT, ...rest } = where;
  if (!matchClause(row, rest)) return false;
  if (AND && Array.isArray(AND) && !AND.every((w) => matchWhere(row, w))) return false;
  if (OR && Array.isArray(OR) && !OR.some((w) => matchWhere(row, w))) return false;
  if (NOT && !!matchWhere(row, NOT)) return false;
  return true;
};

const expandTagsOnPost = (post) => {
  const links = [...memDb.postTags.values()].filter((pt) => pt.postId === post.id);
  return {
    ...post,
    tags: links.map((pt) => ({
      tag: memDb.tags.get(pt.tagId) ? { ...memDb.tags.get(pt.tagId) } : null,
    })),
  };
};

class FakePrismaClient {
  constructor() {
    this.tag = {
      upsert: async ({ where, update: _update, create }) => {
        // 라우터는 name unique 로만 upsert.
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
    };

    this.post = {
      create: async ({ data, include }) => {
        // tags.connectOrCreate 처리 → PostTag 링크 생성
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

        if (tagsBlock?.create) {
          for (const link of tagsBlock.create) {
            // link.tag.connectOrCreate: { where:{name}, create:{name} }
            const coc = link.tag?.connectOrCreate;
            if (!coc) continue;
            let tag = [...memDb.tags.values()].find((t) => t.name === coc.where.name);
            if (!tag) {
              const tid = coc.create.id ?? nextId('tag');
              tag = { id: tid, name: coc.create.name };
              memDb.tags.set(tid, tag);
            }
            memDb.postTags.set(`${id}::${tag.id}`, { postId: id, tagId: tag.id });
          }
        }

        return include?.tags ? expandTagsOnPost({ ...row }) : { ...row };
      },

      findUnique: async ({ where, include }) => {
        for (const p of memDb.posts.values()) {
          if (matchWhere(p, where)) {
            return include?.tags ? expandTagsOnPost({ ...p }) : { ...p };
          }
        }
        return null;
      },

      findMany: async ({ where, include, orderBy, take, cursor, skip }) => {
        // tag 필터는 where.tags.some.tag.name — matchWhere 가 다루기 전에 분리.
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

        // orderBy: createdAt desc + id desc (tie-break)
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
          // cursor 가 매칭 안 되면 진짜 Prisma 는 P2025 던지는데, 테스트 fake
          // 에서는 첫 페이지 재반환을 막기 위해 빈 결과를 반환 — 페이지네이션
          // 버그가 silent 통과하는 일을 막음.
          if (idx < 0) return [];
          rows = rows.slice(idx + (skip ?? 0));
        }
        if (typeof take === 'number') rows = rows.slice(0, take);

        return rows.map((p) => (include?.tags ? expandTagsOnPost(p) : { ...p }));
      },

      delete: async ({ where }) => {
        for (const [id, p] of memDb.posts) {
          if (matchWhere(p, where)) {
            memDb.posts.delete(id);
            // Cascade: PostTag 링크 삭제
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
