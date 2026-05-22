/**
 * 학교 인증 메일 템플릿 테스트 (Issue #542).
 *
 * 커버리지:
 *  - subject / text / html 모두 반환
 *  - verifyUrl 변수 치환 (text + html)
 *  - HTML escape (XSS 방어)
 *  - 토큰 평문은 URL 안에만 노출 — 본문에 별도 노출 X
 *  - TTL 분→사람-읽기 형식 변환
 *  - 잘못된 입력 (빈 verifyUrl) → throw
 */
import { describe, it, expect } from 'vitest';

import { renderSchoolVerifyEmail, escapeHtml } from '../src/lib/templates/school-verify.js';

const URL_OK = 'https://auth.get-it.cloud/verify-school?token=abc123def456';

describe('renderSchoolVerifyEmail (#542)', () => {
  it('returns subject / text / html', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    expect(r.subject).toBe('[GETIT/9] 학교 인증 메일');
    expect(typeof r.text).toBe('string');
    expect(typeof r.html).toBe('string');
    expect(r.text.length).toBeGreaterThan(20);
    expect(r.html.length).toBeGreaterThan(50);
  });

  it('embeds verifyUrl in text and html', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    expect(r.text).toContain(URL_OK);
    // html 은 href + 표시 텍스트 양쪽에 들어감.
    expect(r.html).toContain(`href="${URL_OK}"`);
  });

  it('mentions 30-minute TTL by default', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    expect(r.text).toMatch(/30분/);
    expect(r.html).toMatch(/30분/);
  });

  it('accepts custom expiresInMinutes', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK, expiresInMinutes: 15 });
    expect(r.text).toMatch(/15분/);
    expect(r.html).toMatch(/15분/);
  });

  it('formats hour+minute for >=60', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK, expiresInMinutes: 90 });
    expect(r.text).toMatch(/1시간 30분/);
  });

  it('falls back to 30분 on invalid expiresInMinutes', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK, expiresInMinutes: -5 });
    expect(r.text).toMatch(/30분/);
  });

  it('includes "ignore if not you" notice (한국어 반말)', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    // strict 카피 일치 (regression 방지).
    expect(r.text).toMatch(/본인이 요청하지 않았다면/);
    expect(r.html).toMatch(/본인이 요청하지 않았다면/);
  });

  it('uses 반말 tone (안녕, ~줘)', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    expect(r.text).toMatch(/안녕/);
    expect(r.text).toMatch(/눌러줘|줘\./); // 줘 패턴
  });

  it('mentions student ID 8자리 입력 안내', () => {
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    expect(r.text).toMatch(/학번 8자리/);
    expect(r.html).toMatch(/학번 8자리/);
  });

  it('does NOT leak plaintext token outside the URL', () => {
    // 토큰 평문 부분 추출.
    const rawToken = 'abc123def456';
    const r = renderSchoolVerifyEmail({ verifyUrl: URL_OK });
    // text: 토큰은 URL 한 줄 안에만. URL 라인 제거 후엔 토큰 X.
    const textNoUrl = r.text.replace(new RegExp(URL_OK.replace(/[/.?=]/g, '\\$&'), 'g'), '');
    expect(textNoUrl).not.toContain(rawToken);
    // html: href + 표시 텍스트 안에만. <a> 태그 둘러싼 부분 제거 후엔 토큰 X.
    const htmlNoUrl = r.html.replace(new RegExp(URL_OK.replace(/[/.?=]/g, '\\$&'), 'g'), '');
    expect(htmlNoUrl).not.toContain(rawToken);
  });

  it('HTML escapes special characters in verifyUrl', () => {
    const evil = 'https://auth.get-it.cloud/verify-school?token=ab"><script>x</script>';
    const r = renderSchoolVerifyEmail({ verifyUrl: evil });
    // raw 스크립트 태그 / 닫는 따옴표가 html 에 그대로 들어가면 안 됨.
    expect(r.html).not.toContain('<script>');
    expect(r.html).not.toContain('"><script');
    // escape 된 형태가 있어야 함.
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('throws if verifyUrl is missing or empty', () => {
    expect(() => renderSchoolVerifyEmail({ verifyUrl: '' })).toThrow();
    expect(() => renderSchoolVerifyEmail({})).toThrow();
  });
});

describe('escapeHtml (#542)', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(123)).toBe('123');
  });
});
