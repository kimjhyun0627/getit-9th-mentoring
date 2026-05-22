/**
 * 학교 인증 메일 템플릿 (Issue #542, PRD `.claude/projects/school-auth.md` §이메일 템플릿).
 *
 * 정책:
 *  - Subject: `[GETIT/9] 학교 인증 메일` (기존 verify/reset 메일 prefix 와 톤 통일).
 *  - 톤: 한국어 반말 — 서비스 톤 일관성 (기존 sendVerifyEmail / sendPasswordResetEmail 답습).
 *  - 30분 TTL 본문에 명시.
 *  - "본인이 요청하지 않았다면 무시" 안내 포함.
 *  - 토큰 평문은 **URL 안에만** — 본문 어디에도 별도 노출 X (CR #546 패턴).
 *  - HTML 은 inline style only — Gmail / Outlook / iOS Mail 호환. <head> / <style> 블록 금지.
 *  - 다크모드 지원은 클라이언트 측 자동 반전에 위임 (#fff/#111 대비만 보장).
 *
 * 의존성 0 — pure 함수. 테스트 가능.
 */

/**
 * 신뢰 가능한 정수만 사용해서 분/시간 문자열을 만든다. NaN/음수/0~1 소수 방어.
 *
 * - `m >= 1` 인 finite number → Math.floor(m) 사용
 * - 그 외 (NaN, 0, 음수, 0 < m < 1) → 기본 30분 fallback (Gemini #548 권고)
 *
 * @param {number} m
 * @returns {string} "30분" / "1시간 30분" 형식.
 */
const formatDuration = (m) => {
  const n = Number.isFinite(m) && m >= 1 ? Math.floor(m) : 30;
  if (n < 60) return `${n}분`;
  const h = Math.floor(n / 60);
  const rest = n % 60;
  return rest === 0 ? `${h}시간` : `${h}시간 ${rest}분`;
};

/**
 * HTML escape — 템플릿 변수가 메일 본문에 들어갈 때 XSS / 깨짐 방지.
 * 메일 클라이언트는 일반 브라우저보다 sanitizer 가 느슨한 곳이 많아서
 * verifyUrl 같은 외부 입력은 반드시 escape.
 *
 * @param {string} s
 * @returns {string}
 */
export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * 학교 인증 메일 렌더링.
 *
 * @param {object} args
 * @param {string} args.verifyUrl - 평문 토큰 포함된 1회용 인증 URL.
 * @param {number} [args.expiresInMinutes] - 토큰 유효 시간(분). 기본 30.
 * @returns {{ subject: string, text: string, html: string }}
 */
export const renderSchoolVerifyEmail = ({ verifyUrl, expiresInMinutes = 30 }) => {
  if (typeof verifyUrl !== 'string' || verifyUrl.length === 0) {
    throw new TypeError('verifyUrl is required');
  }
  const duration = formatDuration(expiresInMinutes);
  const safeUrl = escapeHtml(verifyUrl);

  const subject = '[GETIT/9] 학교 인증 메일';

  // 평문 — 메일 클라이언트가 HTML 못 그릴 때 fallback.
  // 토큰(URL) 외엔 token 평문 흘리지 않음.
  const text = [
    '안녕, GETIT 9기야.',
    '',
    `학교 인증을 마치려면 아래 링크를 ${duration} 안에 눌러줘.`,
    verifyUrl,
    '',
    '링크를 누르면 학번 8자리 입력 화면이 나와. 입력까지 마쳐야 인증이 완료돼.',
    '',
    '본인이 요청하지 않았다면 이 메일은 그냥 무시하면 돼.',
    '',
    '— GETIT/9',
  ].join('\n');

  // HTML — 모든 style 은 inline. Outlook 호환 위해 <table> wrapping 도 가능하지만
  // 본 템플릿은 기존 메일(평문 위주) 톤과 맞추기 위해 가벼운 div 구조만 사용.
  //
  // <body> 태그 스타일은 Gmail / Outlook.com 가 무시/제거하는 경우가 많아서
  // (Gemini #548 지적) 모든 스타일을 outer wrapper <div> 로 옮겼다.
  // <body> 는 reset 정도만 — 클라이언트가 태그를 떼어내도 wrapper 가 살아남게.
  const html = [
    '<!DOCTYPE html>',
    '<html lang="ko">',
    '<body style="margin:0;padding:0;">',
    "<div style=\"width:100%;background:#f7f7f8;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Apple SD Gothic Neo','Noto Sans KR',sans-serif;\">",
    '<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;color:#111111;line-height:1.6;">',
    '<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111111;">학교 인증 메일</h1>',
    '<p style="margin:0 0 12px 0;font-size:15px;color:#222222;">안녕, GETIT 9기야.</p>',
    `<p style="margin:0 0 20px 0;font-size:15px;color:#222222;">학교 인증을 마치려면 아래 버튼을 <strong>${escapeHtml(duration)}</strong> 안에 눌러줘.</p>`,
    '<p style="margin:0 0 24px 0;">',
    `<a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#111111;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">학교 인증하기</a>`,
    '</p>',
    '<p style="margin:0 0 8px 0;font-size:13px;color:#555555;">버튼이 동작하지 않으면 아래 주소를 복사해서 브라우저에 붙여넣어줘.</p>',
    `<p style="margin:0 0 24px 0;font-size:13px;color:#0a58ca;word-break:break-all;"><a href="${safeUrl}" style="color:#0a58ca;text-decoration:underline;">${safeUrl}</a></p>`,
    '<p style="margin:0 0 8px 0;font-size:14px;color:#222222;">링크를 누르면 학번 8자리 입력 화면이 나와. 입력까지 마쳐야 인증이 완료돼.</p>',
    '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e7;" />',
    '<p style="margin:0;font-size:12px;color:#888888;">본인이 요청하지 않았다면 이 메일은 그냥 무시하면 돼.</p>',
    '<p style="margin:8px 0 0 0;font-size:12px;color:#888888;">— GETIT/9</p>',
    '</div>',
    '</div>',
    '</body>',
    '</html>',
  ].join('');

  return { subject, text, html };
};
