/**
 * Kakao thumbnail URL 을 hi-res 로 클라이언트 측에서 방어적으로 업스케일.
 *
 * #474 — BE 의 `upscaleKakaoThumbnail` 은 신규 fetch 시점에만 적용되므로
 * #366 머지 전 캐시된 row 는 24h TTL 만료까지 저화질을 응답한다.
 * 일회성 백필 스크립트로 DB 를 갱신하지만, FE 에서도 동일 로직으로 한 번 더
 * 변환하면 (a) 백필 누락분 (b) 머지 직후 짧은 윈도우 동안 stale row 에 대해
 * 즉시 hi-res 로 보이게 된다 — 무비용 이중 안전.
 *
 * 정책은 shelf-api `upscaleKakaoThumbnail` 과 동일:
 * - kakaocdn.net (또는 그 서브도메인) 호스트만 손댐
 * - `/thumb/[A-Z]\d+x\d+` 토큰을 `R480x696` 으로 치환
 * - 그 외는 입력 그대로 반환 (외부 이미지/테스트 자산 보호)
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
  const next = parsed.pathname.replace(/^\/thumb\/[A-Z]\d+x\d+/i, '/thumb/R480x696');
  if (next === parsed.pathname) return url;
  parsed.pathname = next;
  return parsed.toString();
};
