/**
 * Kakao thumbnail URL → 원본 daumcdn URL 클라이언트 측 방어적 추출.
 *
 * #507 — Kakao thumb 서버 (`openresty`) 가 임의 사이즈 변환을 거부 (403,
 * `op not allowed, Please check on type & size & option`).
 * PR #366 의 R480x696 upscale 이 라이브에서 깨졌다.
 *
 * 정책 (shelf-api `extractKakaoOriginUrl` 와 동일):
 * - kakaocdn.net (또는 그 서브도메인) `/thumb/...?fname=<URL>` 형태면
 *   fname 쿼리의 원본 URL 을 추출해서 반환 (daumcdn 직접 사용).
 * - 외부 호스트 / fname 누락 / fname 이 URL 아님 / 위험 스킴 → 입력 그대로.
 *
 * BE 가 신규 응답을 원본 URL 로 박는 동안 (백필 머지/실행 사이의 짧은 윈도우),
 * FE 가 동일 로직으로 한 번 더 변환하면 stale kakaocdn URL 도 즉시 원본으로 풀린다 —
 * 무비용 이중 안전.
 *
 * @param {string | null | undefined} url
 * @returns {string} 빈/null 입력은 빈 문자열로 정규화
 */
export const upscaleCoverUrl = (url) => {
  if (!url) return '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  const isKakaoCdn = host === 'kakaocdn.net' || host.endsWith('.kakaocdn.net');
  if (!isKakaoCdn) return url;
  if (!parsed.pathname.startsWith('/thumb/')) return url;

  const fname = parsed.searchParams.get('fname');
  if (!fname) return url;

  let originUrl;
  try {
    originUrl = new URL(fname);
  } catch {
    return url;
  }
  if (originUrl.protocol !== 'http:' && originUrl.protocol !== 'https:') return url;
  return originUrl.toString();
};
