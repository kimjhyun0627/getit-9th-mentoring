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
