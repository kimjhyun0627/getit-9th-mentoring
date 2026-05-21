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
 * #529 — Mixed Content 회귀. 카카오가 fname 을 `http://t1.daumcdn.net/...` (HTTP) 로
 * 응답 → DB stale row 도 일부 http 로 박혀있음. shelf-web 은 HTTPS 페이지 → 콘솔에
 * Mixed Content 경고. BE 도 동일 패치하지만 DB 백필이 deploy 후 prisma migrate deploy
 * 시점에 들어가므로 FE 도 같이 잠가서 노출 윈도우 0.
 * - kakaocdn fname=http → 추출 후 https 로 업그레이드.
 * - DB 에 직접 박힌 http://daumcdn 등 외부 http URL 도 https 로 업그레이드 (안전망).
 *   (http:// 로 시작하는 URL 을 무조건 https 로 끌어올림. 모든 책 표지 CDN 은
 *   https 지원이 표준이며, 만약 끝까지 http 만 지원한다면 콘솔에 깨진 이미지로
 *   드러나는 게 Mixed Content 보다 안전.)
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

  // kakaocdn thumb 경로면 fname 의 원본 URL 추출.
  if (isKakaoCdn && parsed.pathname.startsWith('/thumb/')) {
    const fname = parsed.searchParams.get('fname');
    if (fname) {
      let originUrl;
      try {
        originUrl = new URL(fname);
      } catch {
        return forceHttps(parsed);
      }
      // 추출된 원본 URL 이 http/https 면 forceHttps 로 일관 처리 (CR review #530).
      // 위험 스킴 (data:/javascript:) → 원본 thumb URL 유지 (http→https 만 잠금).
      if (originUrl.protocol === 'http:' || originUrl.protocol === 'https:') {
        return forceHttps(originUrl);
      }
      return forceHttps(parsed);
    }
  }

  // 그 외 모든 URL — http 면 https 로 업그레이드 (stale DB row 방어).
  return forceHttps(parsed);
};

/**
 * URL 객체의 protocol 이 http 면 https 로 잠그고 문자열로 직렬화.
 * 다른 스킴은 입력 그대로의 문자열 반환.
 *
 * @param {URL} parsed
 * @returns {string}
 */
const forceHttps = (parsed) => {
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
  }
  return parsed.toString();
};
