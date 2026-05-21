/**
 * #507 — FE 방어적 fname 추출 회귀 테스트. shelf-api kakao.test 의 정책 미러.
 */
import { describe, it, expect } from 'vitest';

import { upscaleCoverUrl } from './coverUrl.js';

describe('upscaleCoverUrl — Kakao thumb URL → fname 원본 URL 추출', () => {
  it('kakaocdn thumb → fname 의 daumcdn 원본 URL', () => {
    expect(
      upscaleCoverUrl(
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F123.jpg',
      ),
    ).toBe('https://t1.daumcdn.net/lbook/image/123.jpg');
  });

  it('사이즈 토큰 무관 (C98x140, R480x696 등)', () => {
    expect(
      upscaleCoverUrl(
        'https://search1.kakaocdn.net/thumb/C98x140.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2Fc.jpg',
      ),
    ).toBe('https://t1.daumcdn.net/lbook/image/c.jpg');
    expect(
      upscaleCoverUrl(
        'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2Fhi.jpg',
      ),
    ).toBe('https://t1.daumcdn.net/lbook/image/hi.jpg');
  });

  it('kakaocdn 아닌 호스트는 그대로', () => {
    expect(upscaleCoverUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
  });

  it('외부 호스트 쿼리에 kakaocdn 문자열 포함해도 그대로 (substring 매칭 X)', () => {
    const proxied =
      'https://proxy.example.com/image?src=https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x';
    expect(upscaleCoverUrl(proxied)).toBe(proxied);
  });

  it('null/undefined/빈문자열 → 빈 문자열', () => {
    expect(upscaleCoverUrl(null)).toBe('');
    expect(upscaleCoverUrl(undefined)).toBe('');
    expect(upscaleCoverUrl('')).toBe('');
  });

  it('파싱 불가능한 URL → 입력 그대로', () => {
    expect(upscaleCoverUrl('not a url')).toBe('not a url');
  });

  it('fname 없는 kakaocdn thumb URL → 원본 유지', () => {
    const noFname = 'https://search1.kakaocdn.net/thumb/R120x174.q85/';
    expect(upscaleCoverUrl(noFname)).toBe(noFname);
  });

  it('fname 이 URL 형식 아님 → 원본 유지', () => {
    const broken = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=not-a-url';
    expect(upscaleCoverUrl(broken)).toBe(broken);
  });

  it('fname 이 위험 스킴 (javascript:/data:) → 원본 유지', () => {
    const evil = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=javascript%3Aalert(1)';
    expect(upscaleCoverUrl(evil)).toBe(evil);
  });

  it('원본 daumcdn URL 이 이미 직접 박혀있으면 그대로', () => {
    const direct = 'https://t1.daumcdn.net/lbook/image/123.jpg';
    expect(upscaleCoverUrl(direct)).toBe(direct);
  });
});
