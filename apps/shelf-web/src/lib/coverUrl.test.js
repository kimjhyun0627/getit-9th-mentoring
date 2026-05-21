/**
 * #474 — FE 방어적 업스케일 회귀 테스트. shelf-api kakao.test 의 정책 미러.
 */
import { describe, it, expect } from 'vitest';

import { upscaleCoverUrl } from './coverUrl.js';

describe('upscaleCoverUrl — Kakao thumbnail R120x174 → R480x696', () => {
  it('kakaocdn R120x174 → R480x696', () => {
    expect(
      upscaleCoverUrl(
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F123.jpg',
      ),
    ).toBe(
      'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F123.jpg',
    );
  });

  it('다른 사이즈 토큰 (C98x140, R98x140) 도 R480x696 로', () => {
    expect(upscaleCoverUrl('https://search1.kakaocdn.net/thumb/C98x140.q85/?fname=x')).toBe(
      'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=x',
    );
    expect(upscaleCoverUrl('https://search1.kakaocdn.net/thumb/R98x140.q85/?fname=x')).toBe(
      'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=x',
    );
  });

  it('이미 R480x696 이면 변화 없음', () => {
    const hi = 'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=x';
    expect(upscaleCoverUrl(hi)).toBe(hi);
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
});
