/**
 * safeRedirect — 오픈 리다이렉트 방어 (school-auth #540).
 *
 * 정책 (PRD .claude/projects/school-auth.md "?redirect= 보안 정책" 섹션):
 *   - 허용 도메인 allowlist: `get-it.cloud` (정확 매치) + 1레벨 서브도메인
 *     `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.get-it\.cloud$`.
 *   - 처리 절차:
 *       (1) URL 디코딩 (decodeURIComponent — 호출 측에서 미리 해주는 경우도 있어 둘 다 OK)
 *       (2) new URL(value) 파싱 — base 인자 없음. relative URL throw → reject.
 *       (3) host.toLowerCase() 정규화 후 검증.
 *       (4) 매치 실패 시 안전 디폴트 `https://get-it.cloud` 폴백.
 */
import { describe, expect, it } from 'vitest';

import { safeRedirect } from './safeRedirect.js';

// `new URL(...).toString()` 은 root path 를 `/` 로 정규화하므로 디폴트도 trailing slash 포함.
const SAFE_DEFAULT = 'https://get-it.cloud/';

describe('safeRedirect', () => {
  describe('허용 (allowlist match)', () => {
    it.each([
      ['https://get-it.cloud', 'https://get-it.cloud/'],
      ['https://get-it.cloud/', 'https://get-it.cloud/'],
      ['https://get-it.cloud/me', 'https://get-it.cloud/me'],
      ['https://auth.get-it.cloud/login', 'https://auth.get-it.cloud/login'],
      ['https://hobby.get-it.cloud/posts/abc?x=1', 'https://hobby.get-it.cloud/posts/abc?x=1'],
      ['https://shelf.get-it.cloud/', 'https://shelf.get-it.cloud/'],
      ['https://board.get-it.cloud/', 'https://board.get-it.cloud/'],
      ['https://letter.get-it.cloud/', 'https://letter.get-it.cloud/'],
    ])('allowlist host 그대로 통과: %s', (input, expected) => {
      expect(safeRedirect(input)).toBe(expected);
    });

    it('host 대문자 입력도 lowercase 정규화 후 통과', () => {
      expect(safeRedirect('https://AUTH.GET-IT.CLOUD/me')).toBe('https://auth.get-it.cloud/me');
    });

    it('URL 인코딩된 입력도 디코딩 후 검사', () => {
      const encoded = encodeURIComponent('https://hobby.get-it.cloud/posts');
      expect(safeRedirect(encoded)).toBe('https://hobby.get-it.cloud/posts');
    });
  });

  describe('거부 (allowlist miss → safe default)', () => {
    it.each([
      ['https://evil.com'],
      ['https://get-it.cloud.evil.com'], // suffix attack
      ['https://a.b.get-it.cloud'], // 다중 레벨 서브도메인
      ['https://-foo.get-it.cloud'], // hyphen 으로 시작
      ['https://foo-.get-it.cloud'], // hyphen 으로 끝
      ['javascript:alert(1)'], // 스킴 공격
      ['data:text/html,<script>'], // data URL
      ['//evil.com/path'], // protocol-relative — new URL(value) base 없으면 throw
      ['/me'], // relative path — new URL(value) throw
      [''],
    ])('reject → safe default: %s', (input) => {
      expect(safeRedirect(input)).toBe(SAFE_DEFAULT);
    });

    it('null / undefined → safe default', () => {
      expect(safeRedirect(null)).toBe(SAFE_DEFAULT);
      expect(safeRedirect(undefined)).toBe(SAFE_DEFAULT);
    });

    it('비문자열 입력 → safe default (panic 없음)', () => {
      expect(safeRedirect(123)).toBe(SAFE_DEFAULT);
      expect(safeRedirect({})).toBe(SAFE_DEFAULT);
    });
  });

  describe('safeDefault 인자', () => {
    it('호출자가 다른 안전 디폴트 지정 가능', () => {
      expect(safeRedirect('https://evil.com', 'https://hobby.get-it.cloud')).toBe(
        'https://hobby.get-it.cloud/',
      );
    });

    it('safeDefault 자체가 invalid 면 hard-coded SAFE_DEFAULT 폴백', () => {
      expect(safeRedirect('https://evil.com', 'javascript:alert(1)')).toBe(SAFE_DEFAULT);
    });
  });

  describe('protocol 제한', () => {
    it('http / https 만 허용 — 그 외 스킴은 reject', () => {
      expect(safeRedirect('ftp://get-it.cloud/path')).toBe(SAFE_DEFAULT);
    });

    it('http://get-it.cloud — 정확히 매치하면 http 도 허용 (dev 환경 대응)', () => {
      expect(safeRedirect('http://get-it.cloud/dev')).toBe('http://get-it.cloud/dev');
    });
  });
});
