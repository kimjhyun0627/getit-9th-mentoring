/**
 * Seed 멱등성 단위 테스트.
 *
 * - 실제 MySQL 없이 in-memory fake Prisma 로 upsert 동작을 시뮬레이션.
 * - main() 을 2회 실행 후 tag / post / postTag 카운트·내용이 동일함을 검증.
 * - CR thread (seed.js:89) 의 "DB 시드 플로우 멱등성 테스트" 요구 충족.
 *
 * 진짜 MySQL 연동 통합 테스트는 docker-compose 기반 CI 가 붙는 추후 이슈에서 추가 예정.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { main, SEED_TAGS, SEED_POST, SEED_POST_TAGS } from '../prisma/seed.js';

/**
 * unique key 로 row 를 들고 있는 in-memory 테이블.
 * upsert(where, update, create) 구현.
 */
const makeTable = (keyOf) => {
  const rows = new Map();
  return {
    rows,
    async upsert({ where, update, create }) {
      const key = keyOf(where);
      const existing = rows.get(key);
      if (existing) {
        const next = { ...existing, ...update };
        rows.set(key, next);
        return next;
      }
      const fresh = { ...create };
      rows.set(key, fresh);
      return fresh;
    },
    count() {
      return rows.size;
    },
    toArray() {
      return [...rows.values()];
    },
  };
};

const makeFakePrisma = () => {
  let tagAutoId = 0;

  const tag = makeTable((where) => where.name);
  const tagOrigUpsert = tag.upsert.bind(tag);
  tag.upsert = async (args) => {
    const created = { ...args.create };
    if (!created.id) created.id = `tag-${++tagAutoId}`;
    return tagOrigUpsert({ ...args, create: created });
  };

  const post = makeTable((where) => where.id);
  const postTag = makeTable((where) => `${where.postId_tagId.postId}::${where.postId_tagId.tagId}`);

  return {
    tag,
    post,
    postTag,
    async $disconnect() {},
  };
};

describe('hobby-api seed', () => {
  /** @type {ReturnType<typeof makeFakePrisma>} */
  let prisma;

  beforeEach(() => {
    prisma = makeFakePrisma();
  });

  it('seed 1회 실행 후 tag/post/postTag 카운트가 spec 과 일치한다', async () => {
    await main(prisma);

    expect(prisma.tag.count()).toBe(SEED_TAGS.length); // 3
    expect(prisma.post.count()).toBe(1);
    expect(prisma.postTag.count()).toBe(SEED_POST_TAGS.length); // 2

    const seededPost = prisma.post.toArray()[0];
    expect(seededPost.id).toBe(SEED_POST.id);
    expect(seededPost.title).toBe(SEED_POST.title);
  });

  it('seed 2회 실행해도 멱등 — 카운트·내용 동일, 중복 row 없음', async () => {
    await main(prisma);
    const snap1 = {
      tags: prisma.tag
        .toArray()
        .map((t) => t.name)
        .sort(),
      posts: prisma.post
        .toArray()
        .map((p) => p.id)
        .sort(),
      postTags: prisma.postTag
        .toArray()
        .map((pt) => `${pt.postId}::${pt.tagId}`)
        .sort(),
    };

    await main(prisma);
    const snap2 = {
      tags: prisma.tag
        .toArray()
        .map((t) => t.name)
        .sort(),
      posts: prisma.post
        .toArray()
        .map((p) => p.id)
        .sort(),
      postTags: prisma.postTag
        .toArray()
        .map((pt) => `${pt.postId}::${pt.tagId}`)
        .sort(),
    };

    expect(snap2).toEqual(snap1);
    expect(prisma.tag.count()).toBe(SEED_TAGS.length);
    expect(prisma.post.count()).toBe(1);
    expect(prisma.postTag.count()).toBe(SEED_POST_TAGS.length);
  });
});
