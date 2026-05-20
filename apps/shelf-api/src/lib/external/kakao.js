/**
 * 카카오 도서 검색 API 클라이언트.
 *
 * - 키워드 또는 ISBN 검색 → documents 배열 반환
 * - 도메인 매핑(`toBookRecord`): 카카오 응답 1건 → Prisma `Book` 모델 입력
 *   - isbn: "ISBN10 ISBN13" 공백 결합 형태 → 13자리 우선 추출
 *   - authors: 배열 → 콤마 결합
 *   - datetime: ISO 문자열 → Date 객체 (실패 시 null)
 * - 키 미설정 시 `KakaoConfigError`, 외부 호출 실패 시 `KakaoApiError` 던짐
 *
 * 라우터는 에러 종류로 503 vs 404 vs 500 을 결정한다.
 */
const KAKAO_BASE_URL = 'https://dapi.kakao.com';
const KAKAO_SEARCH_PATH = '/v3/search/book';

/** 카카오 API 키 미설정 — 운영자가 .env 채워야 함. 라우터가 503 으로 매핑. */
export class KakaoConfigError extends Error {
  constructor(message = 'KAKAO_BOOK_API_KEY is not configured') {
    super(message);
    this.name = 'KakaoConfigError';
  }
}

/** 카카오 API 호출 실패 — 4xx/5xx/네트워크. 라우터가 503 으로 매핑. */
export class KakaoApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'KakaoApiError';
    this.status = status;
  }
}

/**
 * 카카오 isbn 필드("8932917248 9788932917245") 에서 13자리 우선 추출.
 *
 * @param {string | undefined} raw
 * @returns {string | null}
 */
const pickIsbn = (raw) => {
  if (!raw) return null;
  const tokens = String(raw)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const isbn13 = tokens.find((t) => /^\d{13}$/.test(t));
  if (isbn13) return isbn13;
  const isbn10 = tokens.find((t) => /^\d{9}[\dXx]$/.test(t));
  if (isbn10) return isbn10;
  return tokens[0] ?? null;
};

/**
 * 카카오 thumbnail URL → 고해상도 변환 (#359).
 *
 * 카카오 검색이 돌려주는 thumbnail 은 기본 `R120x174` (가로 ~120px) 라
 * retina / 큰 카드에서 흐릿하다. kakaocdn 의 사이즈 토큰
 * (`R120x174` / `C98x140` 등 영문1자 + WxH) 만 `R480x696` 으로 바꾸면
 * 같은 자산의 고해상도가 즉시 떨어진다 — 새 endpoint 없음.
 *
 * kakaocdn 호스트가 아닌 URL (테스트/우회 자산) 은 손대지 않는다.
 *
 * @param {string} url
 * @returns {string}
 */
const upscaleKakaoThumbnail = (url) => {
  if (!url) return '';
  if (!/kakaocdn\.net\/thumb\//.test(url)) return url;
  return url.replace(/\/thumb\/[A-Z]\d+x\d+/i, '/thumb/R480x696');
};

/**
 * 카카오 documents[i] 1건을 Prisma Book 입력으로 변환.
 *
 * @param {Record<string, any>} doc
 * @returns {{
 *   isbn: string,
 *   title: string,
 *   author: string,
 *   publisher: string,
 *   publishedAt: Date | null,
 *   coverUrl: string,
 *   description: string,
 *   source: 'kakao',
 * } | null}
 */
export const toBookRecord = (doc) => {
  const isbn = pickIsbn(doc?.isbn);
  if (!isbn) return null;
  const authors = Array.isArray(doc?.authors) ? doc.authors.filter(Boolean) : [];
  let publishedAt = null;
  if (doc?.datetime) {
    const parsed = new Date(doc.datetime);
    publishedAt = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return {
    isbn,
    title: String(doc?.title ?? '').trim(),
    author: authors.join(', '),
    publisher: String(doc?.publisher ?? '').trim(),
    publishedAt,
    coverUrl: upscaleKakaoThumbnail(String(doc?.thumbnail ?? '')),
    description: String(doc?.contents ?? ''),
    source: 'kakao',
  };
};

/**
 * 카카오 도서 검색 호출.
 *
 * @param {{
 *   query: string,
 *   apiKey: string,
 *   target?: 'title' | 'isbn' | 'publisher' | 'person',
 *   size?: number,
 *   timeoutMs?: number,
 * }} params
 * @returns {Promise<Array<Record<string, any>>>}
 * @throws {KakaoConfigError | KakaoApiError}
 */
export const searchKakaoBooks = async ({ query, apiKey, target, size = 10, timeoutMs = 5000 }) => {
  if (!apiKey) throw new KakaoConfigError();

  const url = new URL(KAKAO_SEARCH_PATH, KAKAO_BASE_URL);
  url.searchParams.set('query', query);
  if (target) url.searchParams.set('target', target);
  url.searchParams.set('size', String(size));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: controller.signal,
    });
  } catch (err) {
    throw new KakaoApiError(`kakao fetch failed: ${err?.message ?? 'unknown'}`, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new KakaoApiError(`kakao responded ${res.status}`, res.status);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new KakaoApiError('kakao response not JSON', 502);
  }
  return Array.isArray(body?.documents) ? body.documents : [];
};
