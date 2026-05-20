/**
 * `@getit/schemas/hobby` 의 Zod 스키마 단위 테스트.
 */
import { describe, it, expect } from 'vitest';

import { PostCreateInput, PostListQuery, PostIdParam, PostStatus } from './hobby.js';

const future = (offsetMs = 60 * 60 * 1000) => new Date(Date.now() + offsetMs).toISOString();

const validCreate = () => ({
  title: '북문 마라탕 3명',
  body: '오늘 저녁 6시',
  meetAt: future(),
  capacity: 3,
  openChatUrl: 'https://open.kakao.com/o/test',
  tags: ['음식', 'sports-1'],
});

describe('PostCreateInput', () => {
  it('정상 입력 통과', () => {
    const r = PostCreateInput.safeParse(validCreate());
    expect(r.success).toBe(true);
  });

  it('title 1자 → 400', () => {
    const r = PostCreateInput.safeParse({ ...validCreate(), title: 'a' });
    expect(r.success).toBe(false);
  });

  it('meetAt 과거 → 400', () => {
    const r = PostCreateInput.safeParse({
      ...validCreate(),
      meetAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it('capacity 1 → 400', () => {
    const r = PostCreateInput.safeParse({ ...validCreate(), capacity: 1 });
    expect(r.success).toBe(false);
  });

  it('capacity 21 → 400', () => {
    const r = PostCreateInput.safeParse({ ...validCreate(), capacity: 21 });
    expect(r.success).toBe(false);
  });

  it('openChatUrl http (비-https) → 400', () => {
    const r = PostCreateInput.safeParse({
      ...validCreate(),
      openChatUrl: 'http://open.kakao.com/o/test',
    });
    expect(r.success).toBe(false);
  });

  it('tags 6개 → 400', () => {
    const r = PostCreateInput.safeParse({
      ...validCreate(),
      tags: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(r.success).toBe(false);
  });

  it('tags 비우면 기본 [] 채움', () => {
    const r = PostCreateInput.safeParse({ ...validCreate(), tags: undefined });
    expect(r.success).toBe(true);
    expect(r.data.tags).toEqual([]);
  });

  it('태그 특수문자 → 400', () => {
    const r = PostCreateInput.safeParse({ ...validCreate(), tags: ['hello world'] });
    expect(r.success).toBe(false);
  });
});

describe('PostListQuery', () => {
  it('빈 query → limit 20 default', () => {
    const r = PostListQuery.safeParse({});
    expect(r.success).toBe(true);
    expect(r.data.limit).toBe(20);
  });

  it('limit 문자열 "10" → 숫자 10 coerce', () => {
    const r = PostListQuery.safeParse({ limit: '10' });
    expect(r.success).toBe(true);
    expect(r.data.limit).toBe(10);
  });

  it('limit 100 → 400 (50 초과)', () => {
    const r = PostListQuery.safeParse({ limit: 100 });
    expect(r.success).toBe(false);
  });

  it('status 알 수 없는 값 → 400', () => {
    const r = PostListQuery.safeParse({ status: 'PENDING' });
    expect(r.success).toBe(false);
  });
});

describe('PostStatus', () => {
  it('RECRUITING / FULL / CLOSED 통과', () => {
    expect(PostStatus.safeParse('RECRUITING').success).toBe(true);
    expect(PostStatus.safeParse('FULL').success).toBe(true);
    expect(PostStatus.safeParse('CLOSED').success).toBe(true);
  });
});

describe('PostIdParam', () => {
  it('정상 id 통과', () => {
    const r = PostIdParam.safeParse({ id: 'cuid-12345' });
    expect(r.success).toBe(true);
  });

  it('id 빈 문자열 → 400', () => {
    const r = PostIdParam.safeParse({ id: '' });
    expect(r.success).toBe(false);
  });
});
