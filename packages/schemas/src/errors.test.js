import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { zodErrorBody } from './errors.js';

describe('zodErrorBody', () => {
  it('단일 필드 위반을 ValidationError 포맷으로 직렬화', () => {
    const schema = z.object({ email: z.string().email() });
    const r = schema.safeParse({ email: 'not-an-email' });
    expect(r.success).toBe(false);
    const body = zodErrorBody(r.error);
    expect(body.error).toBe('ValidationError');
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].path).toBe('email');
    expect(typeof body.issues[0].message).toBe('string');
    expect(body.issues[0].message.length).toBeGreaterThan(0);
  });

  it('중첩 path 를 dot-notation 으로 합침', () => {
    const schema = z.object({
      address: z.object({ city: z.string().min(1) }),
    });
    const r = schema.safeParse({ address: { city: '' } });
    expect(r.success).toBe(false);
    const body = zodErrorBody(r.error);
    expect(body.issues[0].path).toBe('address.city');
  });

  it('여러 위반을 모두 보존', () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const r = schema.safeParse({ email: 'bad', password: 'x' });
    expect(r.success).toBe(false);
    const body = zodErrorBody(r.error);
    expect(body.issues.length).toBeGreaterThanOrEqual(2);
    const paths = body.issues.map((i) => i.path);
    expect(paths).toContain('email');
    expect(paths).toContain('password');
  });

  it('루트 레벨 위반은 빈 문자열 path', () => {
    const schema = z.string();
    const r = schema.safeParse(123);
    expect(r.success).toBe(false);
    const body = zodErrorBody(r.error);
    expect(body.issues[0].path).toBe('');
  });

  it('배열 인덱스를 path 에 포함', () => {
    const schema = z.object({ tags: z.array(z.string().min(1)) });
    const r = schema.safeParse({ tags: ['ok', ''] });
    expect(r.success).toBe(false);
    const body = zodErrorBody(r.error);
    expect(body.issues[0].path).toBe('tags.1');
  });

  it('err 가 null/undefined 여도 안전하게 빈 issues 반환', () => {
    expect(zodErrorBody(null)).toEqual({ error: 'ValidationError', issues: [] });
    expect(zodErrorBody(undefined)).toEqual({ error: 'ValidationError', issues: [] });
  });

  it('err.issues 가 없어도 안전하게 빈 issues 반환', () => {
    expect(zodErrorBody({})).toEqual({ error: 'ValidationError', issues: [] });
  });
});
