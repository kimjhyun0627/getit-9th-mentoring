/**
 * 카카오 도서 API 클라이언트 단위 테스트.
 *
 * 카카오 응답 → Book 도메인 객체로 변환하는 매핑을 검증.
 * 외부 HTTP 는 undici MockAgent 로 가로채고, API 키 부재/네트워크 실패/4xx 에지케이스도 다룬다.
 */
import { describe, it, expect } from 'vitest';

import { KakaoConfigError, searchKakaoBooks, toBookRecord } from '../src/lib/external/kakao.js';

import { mockKakaoPool } from './setup.js';

const sampleKakaoDoc = {
  isbn: '8932917248 9788932917245',
  title: '소년이 온다',
  authors: ['한강'],
  publisher: '창비',
  datetime: '2014-05-19T00:00:00.000+09:00',
  thumbnail: 'https://example.com/cover.jpg',
  contents: '5·18 광주 민주화 운동을 다룬 소설',
};

describe('toBookRecord — 카카오 응답을 Book 도메인으로 매핑', () => {
  it('isbn 13자리 우선, authors 콤마결합, datetime → Date', () => {
    const book = toBookRecord(sampleKakaoDoc);
    expect(book).toMatchObject({
      isbn: '9788932917245',
      title: '소년이 온다',
      author: '한강',
      publisher: '창비',
      coverUrl: 'https://example.com/cover.jpg',
      description: '5·18 광주 민주화 운동을 다룬 소설',
      source: 'kakao',
    });
    expect(book.publishedAt).toBeInstanceOf(Date);
  });

  it('isbn 13자리 없으면 10자리 사용', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, isbn: '8932917248' });
    expect(book.isbn).toBe('8932917248');
  });

  it('isbn 비어있으면 null 반환 (skip 표시)', () => {
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '' })).toBeNull();
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: undefined })).toBeNull();
  });

  // #472 — 카카오가 EAN-13 같은 비-ISBN 13자리 코드를 isbn 필드에 섞어 보낼 때
  // 그대로 DB 에 박히던 회귀. 978/979 prefix 검증 + 임의 fallback 제거.
  it('isbn: 978/979 prefix 없는 13자리 (EAN) 는 거른다 → null', () => {
    // 라이브에서 잡힌 케이스 `4808982063008` (박경리 검색 응답).
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '4808982063008' })).toBeNull();
    // 977 (정기간행물 EAN) 도 ISBN 아님.
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '9771234567890' })).toBeNull();
  });

  it('isbn: 978/979 prefix ISBN-13 은 통과', () => {
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '9788932917245' }).isbn).toBe('9788932917245');
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '9791234567890' }).isbn).toBe('9791234567890');
  });

  it('isbn: 비-ISBN 13자리 + 유효 ISBN-10 섞이면 ISBN-10 선택', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, isbn: '4808982063008 8932917248' });
    expect(book.isbn).toBe('8932917248');
  });

  it('isbn: 임의 fallback 제거 — 11자리/12자리 등 형식 미스는 null', () => {
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '12345' })).toBeNull();
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: 'abc' })).toBeNull();
    expect(toBookRecord({ ...sampleKakaoDoc, isbn: '12345678901' })).toBeNull();
  });

  it('authors 다인 → 콤마 결합', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, authors: ['홍길동', '이몽룡'] });
    expect(book.author).toBe('홍길동, 이몽룡');
  });

  it('datetime 누락 → publishedAt null', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, datetime: '' });
    expect(book.publishedAt).toBeNull();
  });

  it('contents/thumbnail 누락 → description/coverUrl 빈 문자열 fallback', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, contents: '', thumbnail: '' });
    expect(book.coverUrl).toBe('');
    expect(book.description).toBe('');
  });

  // #359 — Kakao thumbnail 기본은 R120x174 저화질. CDN URL 의 사이즈 토큰을
  // R480x696 로 갈아끼우면 같은 자산의 고해상도가 즉시 떨어진다.
  it('coverUrl: kakaocdn R120x174 → R480x696 로 업스케일', () => {
    const book = toBookRecord({
      ...sampleKakaoDoc,
      thumbnail:
        'https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F123.jpg',
    });
    expect(book.coverUrl).toBe(
      'https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=https%3A%2F%2Ft1.daumcdn.net%2Flbook%2Fimage%2F123.jpg',
    );
  });

  it('coverUrl: 다른 사이즈 토큰 (R98x140, C120x174 등) 도 모두 R480x696 로', () => {
    expect(
      toBookRecord({
        ...sampleKakaoDoc,
        thumbnail: 'https://search1.kakaocdn.net/thumb/R98x140.q85/?fname=x',
      }).coverUrl,
    ).toBe('https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=x');
    expect(
      toBookRecord({
        ...sampleKakaoDoc,
        thumbnail: 'https://search1.kakaocdn.net/thumb/C120x174.q85/?fname=x',
      }).coverUrl,
    ).toBe('https://search1.kakaocdn.net/thumb/R480x696.q85/?fname=x');
  });

  it('coverUrl: kakaocdn 아닌 URL 은 그대로 유지', () => {
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: 'https://example.com/cover.jpg' });
    expect(book.coverUrl).toBe('https://example.com/cover.jpg');
  });

  // CR #366: 호스트 검증이 substring 매칭이면 외부 호스트의 쿼리/경로에
  // `kakaocdn.net/thumb/` 가 포함될 때 오치환 발생. URL hostname 으로 정확 매칭하는지 잠근다.
  it('coverUrl: 외부 호스트가 쿼리에 kakaocdn 문자열 포함해도 그대로 유지', () => {
    const proxied =
      'https://proxy.example.com/image?src=https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=x';
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: proxied });
    expect(book.coverUrl).toBe(proxied);
  });

  it('coverUrl: 외부 호스트 패스에 /thumb/ 가 있어도 그대로 유지', () => {
    const decoy = 'https://evil.example.com/thumb/R120x174.q85/fake';
    const book = toBookRecord({ ...sampleKakaoDoc, thumbnail: decoy });
    expect(book.coverUrl).toBe(decoy);
  });
});

describe('searchKakaoBooks — HTTP 호출', () => {
  it('API 키 없으면 KakaoConfigError', async () => {
    await expect(searchKakaoBooks({ query: '소년이 온다', apiKey: '' })).rejects.toBeInstanceOf(
      KakaoConfigError,
    );
  });

  it('정상 응답 → documents 배열 반환', async () => {
    mockKakaoPool()
      .intercept({
        method: 'GET',
        path: '/v3/search/book?query=%EC%86%8C%EB%85%84%EC%9D%B4+%EC%98%A8%EB%8B%A4&size=10',
        headers: { authorization: 'KakaoAK test-key' },
      })
      .reply(200, { documents: [sampleKakaoDoc], meta: { total_count: 1 } });

    const docs = await searchKakaoBooks({ query: '소년이 온다', apiKey: 'test-key' });
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('소년이 온다');
  });

  it('isbn 검색 시 target=isbn 파라미터 추가', async () => {
    mockKakaoPool()
      .intercept({
        method: 'GET',
        path: '/v3/search/book?query=9788932917245&target=isbn&size=1',
        headers: { authorization: 'KakaoAK test-key' },
      })
      .reply(200, { documents: [sampleKakaoDoc], meta: { total_count: 1 } });

    const docs = await searchKakaoBooks({
      query: '9788932917245',
      apiKey: 'test-key',
      target: 'isbn',
      size: 1,
    });
    expect(docs).toHaveLength(1);
  });

  it('4xx 응답 → KakaoApiError (status 보존)', async () => {
    mockKakaoPool()
      .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
      .reply(401, { errorType: 'KeyNotExist', message: '키가 없습니다' });

    await expect(searchKakaoBooks({ query: '책', apiKey: 'wrong-key' })).rejects.toMatchObject({
      name: 'KakaoApiError',
      status: 401,
    });
  });

  it('5xx 응답 → KakaoApiError (status=503)', async () => {
    mockKakaoPool()
      .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
      .reply(503, 'Service Unavailable');

    await expect(searchKakaoBooks({ query: '책', apiKey: 'k' })).rejects.toMatchObject({
      name: 'KakaoApiError',
      status: 503,
    });
  });

  it('네트워크 실패 → KakaoApiError (status=502)', async () => {
    mockKakaoPool()
      .intercept({ method: 'GET', path: /^\/v3\/search\/book/ })
      .replyWithError(new Error('ECONNRESET'));

    await expect(searchKakaoBooks({ query: '책', apiKey: 'k' })).rejects.toMatchObject({
      name: 'KakaoApiError',
      status: 502,
    });
  });
});
