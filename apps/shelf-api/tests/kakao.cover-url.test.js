/**
 * 카카오 도서 응답의 coverUrl 매핑 전용 단위 테스트.
 *
 * `toBookRecord` 의 `extractKakaoOriginUrl` 경로만 잠근다 — kakao.test.js 에서
 * 분리 (#530 CR, 300줄 제한 준수).
 *
 * 정책 요약:
 * - kakaocdn.net `/thumb/...?fname=<원본>` → fname 의 원본 URL 추출 (#507).
 * - 외부 호스트 / fname 누락 / fname 이 URL 아님 / 위험 스킴 → 입력 그대로 (#366 CR).
 * - 추출된 http → https 강제 업그레이드 (#529 Mixed Content).
 */
import { describe, it, expect } from 'vitest';

import { toBookRecord } from '../src/lib/external/kakao.js';

const sampleKakaoDoc = {
  isbn: '8932917248 9788932917245',
  title: '소년이 온다',
  authors: ['한강'],
  publisher: '창비',
  datetime: '2014-05-19T00:00:00.000+09:00',
  thumbnail: 'https://example.com/cover.jpg',
  contents: '5·18 광주 민주화 운동을 다룬 소설',
};

describe('toBookRecord — coverUrl (Kakao thumb → 원본 URL 추출)', () => {
  // #507 — Kakao thumb 서버는 임의 사이즈 변환을 거부 (403, op not allowed).
  // PR #366 의 R480x696 upscale 도 라이브에서 깨졌다. fname 쿼리의 원본 URL 을
  // 추출해서 daumcdn 원본을 직접 쓰면 thumb 서버 의존성 제거 + 화질 유지.
  it('kakaocdn thumb → fname 의 원본 URL 추출 (daumcdn)', () => {
    const book = toBookRecord({
      ...sampleKakaoDoc,
      thumbnail:
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F123.jpg',
    });
    expect(book.coverUrl).toBe('https://t1.daumcdn.net/lbook/image/123.jpg');
  });

  it('사이즈 토큰 (R480x696, C120x174 등) 무관하게 fname 원본 사용', () => {
    expect(
      toBookRecord({
        ...sampleKakaoDoc,
        thumbnail:
          'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2Fhi.jpg',
      }).coverUrl,
    ).toBe('https://t1.daumcdn.net/lbook/image/hi.jpg');
    expect(
      toBookRecord({
        ...sampleKakaoDoc,
        thumbnail:
          'https://search1.kakaocdn.net/thumb/C120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2Fc.jpg',
      }).coverUrl,
    ).toBe('https://t1.daumcdn.net/lbook/image/c.jpg');
  });

  it('kakaocdn 아닌 URL 은 그대로 유지', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: 'https://example.com/cover.jpg' });
    expect(book.coverUrl).toBe('https://example.com/cover.jpg');
  });

  // CR #366: 호스트 검증이 substring 매칭이면 외부 호스트의 쿼리/경로에
  // `kakaocdn.net/thumb/` 가 포함될 때 오치환 발생. URL hostname 으로 정확 매칭하는지 잠근다.
  it('외부 호스트가 쿼리에 kakaocdn 문자열 포함해도 그대로 유지', () => {
    const proxied =
      'https://proxy.example.com/image?src=https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x';
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: proxied });
    expect(book.coverUrl).toBe(proxied);
  });

  it('외부 호스트 패스에 /thumb/ 가 있어도 그대로 유지', () => {
    const decoy = 'https://evil.example.com/thumb/R120x174.q85/fake';
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: decoy });
    expect(book.coverUrl).toBe(decoy);
  });

  // #507 edge: fname 이 없거나 형식이 깨졌으면 원본 thumb URL 유지 (fallback).
  it('kakaocdn 이지만 fname 쿼리 없으면 원본 유지', () => {
    const noFname = 'https://search1.kakaocdn.net/thumb/R120x174.q85/';
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: noFname });
    expect(book.coverUrl).toBe(noFname);
  });

  it('fname 이 URL 형식이 아니면 원본 thumb URL 유지', () => {
    const broken = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=not-a-url';
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: broken });
    expect(book.coverUrl).toBe(broken);
  });

  it('fname 이 javascript:/data: 같은 위험 스킴이면 원본 thumb URL 유지', () => {
    const evil = 'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=javascript%3Aalert(1)';
    expect(toBookRecord({ ...sampleKakaoDoc, thumbnail: evil }).coverUrl).toBe(evil);
    const dataUri =
      'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=data%3Atext%2Fhtml%2C%3Cscript%3Ealert(1)%3C%2Fscript%3E';
    expect(toBookRecord({ ...sampleKakaoDoc, thumbnail: dataUri }).coverUrl).toBe(dataUri);
  });

  it('fname 에 query string 이 붙어있어도 그대로 살린다', () => {
    // 일부 응답은 fname=https://...?ext=jpg 처럼 원본 URL 에도 쿼리가 붙는다.
    const book = toBookRecord({
      ...sampleKakaoDoc,
      thumbnail:
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F1.jpg%3Fv%3D2',
    });
    expect(book.coverUrl).toBe('https://t1.daumcdn.net/lbook/image/1.jpg?v=2');
  });

  // #529 — 라이브에서 잡힌 Mixed Content 회귀.
  // 카카오는 fname 을 `http://t1.daumcdn.net/...` (HTTP) 로 박아서 응답한다.
  // shelf-web 은 HTTPS 페이지 → 브라우저 콘솔에 Mixed Content 경고가 뜬다.
  // daumcdn 은 https 정상 지원 → 추출 단계에서 https 로 강제 업그레이드.
  it('fname 이 http:// daumcdn 이면 https:// 로 강제 업그레이드 (#529 mixed content)', () => {
    const book = toBookRecord({
      ...sampleKakaoDoc,
      thumbnail:
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F529.jpg',
    });
    expect(book.coverUrl).toBe('https://t1.daumcdn.net/lbook/image/529.jpg');
  });

  it('fname 이 이미 https 면 그대로 (idempotent)', () => {
    const book = toBookRecord({
      ...sampleKakaoDoc,
      thumbnail:
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2Fidem.jpg',
    });
    expect(book.coverUrl).toBe('https://t1.daumcdn.net/lbook/image/idem.jpg');
  });

  it('http daumcdn + query string 동시에도 https 업그레이드 유지', () => {
    const book = toBookRecord({
      ...sampleKakaoDoc,
      thumbnail:
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=http%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F529.jpg%3Fv%3D3',
    });
    expect(book.coverUrl).toBe('https://t1.daumcdn.net/lbook/image/529.jpg?v=3');
  });
});
