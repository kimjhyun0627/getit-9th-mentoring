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
 * 카카오 isbn 필드("8932917248 9788932917245") 에서 ISBN-13 우선 추출.
 *
 * #472 — 카카오는 EAN-13 (예: `4808982063008`) 처럼 ISBN 이 아닌 13자리 식별자도
 * isbn 필드에 섞어 돌려준다. 단순 `/^\d{13}$/` 통과시키면 DB 에 비-ISBN 코드가
 * 누적되고, `/book/:isbn` 으로 접근 시 캐시가 영구 stale 로 박힘.
 *
 * 규칙:
 * - ISBN-13: `/^97[89]\d{10}$/` (978/979 prefix 필수)
 * - ISBN-10: `/^\d{9}[\dXx]$/`
 * - 둘 다 미스 → null (toBookRecord 가 row drop)
 *
 * 임의 `tokens[0]` fallback 은 제거 — 검증 안 된 식별자가 DB 로 새는 경로 차단.
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
  const isbn13 = tokens.find((t) => /^97[89]\d{10}$/.test(t));
  if (isbn13) return isbn13;
  const isbn10 = tokens.find((t) => /^\d{9}[\dXx]$/.test(t));
  if (isbn10) return isbn10;
  return null;
};

/**
 * 카카오 thumbnail URL → 원본 URL 추출 (#507).
 *
 * 배경:
 * - 카카오 검색은 `https://search1.kakaocdn.net/thumb/R120x174.q85/?fname=<원본URL>`
 *   형태의 썸네일을 돌려준다. fname 은 daumcdn 의 원본 이미지 URL.
 * - PR #366 (#359) 는 사이즈 토큰을 `R480x696` 으로 갈아끼워 화질 개선을 시도.
 *   하지만 Kakao thumb 서버 (`openresty`) 는 임의 사이즈 변환을 거부 (403):
 *     `x-reason: op not allowed, Please check on type & size & option`
 *   → 라이브에서 책 표지 깨짐.
 *
 * 해결:
 * - fname 쿼리 파라미터의 URL 을 추출 + decode 해서 원본 이미지를 직접 사용.
 * - Kakao thumb 서버를 거치지 않으므로 사이즈 제약/403 회피.
 * - daumcdn 의 원본 이미지는 보통 충분히 큰 사이즈 (수백~수천 px) 라
 *   retina/큰 카드에서도 선명. PR #366 의 화질 개선 의도도 충족.
 *
 * 안전장치:
 * - kakaocdn 호스트가 아니거나 fname 이 없으면 입력 그대로 반환 (테스트/외부 URL 보호).
 * - fname 이 URL 형태가 아니면 (decoded 후 `new URL` 실패) 원래 thumb URL 유지.
 *
 * #529 — Mixed Content 회귀: 카카오가 fname 을 `http://t1.daumcdn.net/...` (HTTP) 로 박아서
 * 응답한다. shelf-web 은 HTTPS 페이지라 브라우저 콘솔에 Mixed Content 경고가 뜬다.
 * daumcdn 은 https 정상 지원 → 추출 단계에서 protocol 을 `https:` 로 강제 업그레이드.
 *
 * @param {string} url
 * @returns {string}
 */
const extractKakaoOriginUrl = (url) => {
  if (!url) return '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  // 호스트 정확 매칭: kakaocdn.net 또는 그 서브도메인 (`search1.kakaocdn.net` 등) 만.
  // 외부 호스트가 쿼리/패스에 `kakaocdn.net/thumb/` 문자열을 우연히 포함해도 손대지 않는다.
  const host = parsed.hostname.toLowerCase();
  const isKakaoCdn = host === 'kakaocdn.net' || host.endsWith('.kakaocdn.net');
  if (!isKakaoCdn) return url;
  if (!parsed.pathname.startsWith('/thumb/')) return url;

  const fname = parsed.searchParams.get('fname');
  if (!fname) return url;

  // searchParams.get 은 이미 decode 됨. 다시 decode 하지 않는다 (이중 decode 함정).
  let originUrl;
  try {
    originUrl = new URL(fname);
  } catch {
    return url;
  }
  // 원본 URL 은 http/https 만 허용 (data:/javascript: 등 차단).
  if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') return url;
  // #529 — http → https 강제 업그레이드. daumcdn 등 외부 호스트가 http 로 응답해도
  // shelf-web (HTTPS) 콘솔에 Mixed Content 경고가 뜨지 않도록 BE 응답 단계에서 잠금.
  if (originUrl.protocol === 'http:') originUrl.protocol = 'https:';
  return originUrl.toString();
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
    coverUrl: extractKakaoOriginUrl(String(doc?.thumbnail ?? '')),
    description: String(doc?.contents ?? ''),
    source: 'kakao',
  };
};

/**
 * 카카오 검색 응답의 meta 객체 정규화.
 *
 * 카카오는 다음 필드를 내려준다 (필드 자체가 누락되는 경우는 거의 없지만 방어적으로):
 *  - `is_end`: 현재 페이지가 마지막인지 (boolean)
 *  - `pageable_count`: 페이지네이션 가능한 결과 수 (카카오 기준 보통 ≤ size*50)
 *  - `total_count`: 전체 매칭 수
 *
 * 무한 스크롤 종료 판정은 `is_end` 가 source of truth. FE 가 보너스로 totalCount 도 노출.
 *
 * @param {Record<string, any> | undefined} raw
 * @param {{ documentsLen: number, requestedSize: number }} fallbackHints
 * @returns {{ is_end: boolean, pageable_count: number, total_count: number }}
 */
const normalizeMeta = (raw, { documentsLen, requestedSize }) => {
  const isEndRaw = raw?.is_end;
  // CR #528: total_count 가 누락된 경우 0 으로 박으면 documents 가 실제로 있을 때
  // `totalCount: 0` 이 내려가 응답 모순이 생긴다. 최소한 documentsLen 을 하한으로.
  const totalCount =
    typeof raw?.total_count === 'number' && Number.isFinite(raw.total_count)
      ? raw.total_count
      : documentsLen;
  const pageableCount =
    typeof raw?.pageable_count === 'number' && Number.isFinite(raw.pageable_count)
      ? raw.pageable_count
      : totalCount;
  // is_end 가 누락되면 documents 길이가 size 미만일 때 마지막 페이지로 추론.
  const isEnd =
    typeof isEndRaw === 'boolean' ? isEndRaw : documentsLen < Math.max(1, requestedSize);
  return { is_end: isEnd, pageable_count: pageableCount, total_count: totalCount };
};

/**
 * 카카오 도서 검색 호출.
 *
 * #527: page/size 노출 + meta 동봉. 이전 시그니처는 documents 배열만 반환했지만
 * 무한 스크롤이 추가 fetch 를 알려면 `is_end` 가 필요. 응답 shape 을
 * `{ documents, meta }` 객체로 바꾸고, meta 누락 시에는 documents 길이 기반으로 추론.
 *
 * @param {{
 *   query: string,
 *   apiKey: string,
 *   target?: 'title' | 'isbn' | 'publisher' | 'person',
 *   page?: number,
 *   size?: number,
 *   timeoutMs?: number,
 * }} params
 * @returns {Promise<{
 *   documents: Array<Record<string, any>>,
 *   meta: { is_end: boolean, pageable_count: number, total_count: number },
 * }>}
 * @throws {KakaoConfigError | KakaoApiError}
 */
export const searchKakaoBooks = async ({
  query,
  apiKey,
  target,
  page = 1,
  size = 10,
  timeoutMs = 5000,
}) => {
  if (!apiKey) throw new KakaoConfigError();

  const url = new URL(KAKAO_SEARCH_PATH, KAKAO_BASE_URL);
  url.searchParams.set('query', query);
  if (target) url.searchParams.set('target', target);
  url.searchParams.set('page', String(page));
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
  const documents = Array.isArray(body?.documents) ? body.documents : [];
  const meta = normalizeMeta(body?.meta, { documentsLen: documents.length, requestedSize: size });
  return { documents, meta };
};
