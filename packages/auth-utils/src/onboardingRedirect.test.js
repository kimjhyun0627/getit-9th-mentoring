/**
 * buildNicknameOnboardingUrl — nickname null 사용자를 onboarding 페이지로 보낼 URL 생성기 (#540).
 *
 * 5 web (`auth-web` 자체는 onboarding 페이지가 본인이라 제외, `landing` 도 PRD에서 제외 →
 * `hobby` / `shelf` / `board` / `letter` 가 실제 사용자) 에서 공용으로 사용.
 *
 * 정책:
 *   - `${authOrigin}/onboarding/nickname?redirect=<현재 URL>` 로 보냄.
 *   - `redirect` 파라미터는 `safeRedirect` 통과한 값만 — 자기 자신 URL 도 allowlist host 가 아니면
 *     safe default 로 떨어짐 (dev 환경의 localhost 는 통과 X, prod 만 정상 동작).
 *   - `URLSearchParams` 로 안전하게 인코딩.
 */
import { describe, expect, it } from 'vitest';

// CR nitpick #550 — static import 로 통일 (이전 beforeAll 동적 import 제거).
import {
  buildNicknameOnboardingUrl,
  shouldEnforceNicknameOnboarding,
} from './onboardingRedirect.js';

describe('buildNicknameOnboardingUrl', () => {
  it('현재 URL 을 ?redirect= 로 부착해서 auth onboarding 으로 보냄', () => {
    expect(
      buildNicknameOnboardingUrl({
        authOrigin: 'https://auth.get-it.cloud',
        currentUrl: 'https://hobby.get-it.cloud/posts/abc',
      }),
    ).toBe(
      'https://auth.get-it.cloud/onboarding/nickname?redirect=https%3A%2F%2Fhobby.get-it.cloud%2Fposts%2Fabc',
    );
  });

  it('currentUrl 이 allowlist 밖이면 safe default 로 떨어짐', () => {
    const url = buildNicknameOnboardingUrl({
      authOrigin: 'https://auth.get-it.cloud',
      currentUrl: 'https://evil.com/phish',
    });
    // safeRedirect('https://evil.com/phish') → https://get-it.cloud/ (URL toString trailing slash)
    expect(url).toBe(
      'https://auth.get-it.cloud/onboarding/nickname?redirect=https%3A%2F%2Fget-it.cloud%2F',
    );
  });

  it('authOrigin trailing slash 무시', () => {
    const url = buildNicknameOnboardingUrl({
      authOrigin: 'https://auth.get-it.cloud/',
      currentUrl: 'https://shelf.get-it.cloud/me',
    });
    expect(url.startsWith('https://auth.get-it.cloud/onboarding/nickname?redirect=')).toBe(true);
  });
});

describe('shouldEnforceNicknameOnboarding', () => {
  it('user 없음 → false (비로그인은 redirect 안 함)', () => {
    expect(shouldEnforceNicknameOnboarding({ user: null, currentPath: '/' })).toBe(false);
  });

  it('user.nickname truthy → false (이미 nickname 있음)', () => {
    expect(
      shouldEnforceNicknameOnboarding({ user: { nickname: '길동이' }, currentPath: '/' }),
    ).toBe(false);
  });

  it('user.nickname null → true', () => {
    expect(shouldEnforceNicknameOnboarding({ user: { nickname: null }, currentPath: '/' })).toBe(
      true,
    );
  });

  it('user.nickname undefined → true', () => {
    expect(shouldEnforceNicknameOnboarding({ user: {}, currentPath: '/' })).toBe(true);
  });

  it('user.nickname 빈 문자열 → true', () => {
    expect(shouldEnforceNicknameOnboarding({ user: { nickname: '' }, currentPath: '/' })).toBe(
      true,
    );
  });

  it('user.nickname 공백만 → true', () => {
    expect(shouldEnforceNicknameOnboarding({ user: { nickname: '   ' }, currentPath: '/' })).toBe(
      true,
    );
  });

  it('user 있음 + nickname 없음 + currentPath 가 onboarding 자체 → false (무한 루프 방지)', () => {
    expect(
      shouldEnforceNicknameOnboarding({
        user: { nickname: null },
        currentPath: '/onboarding/nickname',
      }),
    ).toBe(false);
  });

  it('enforced=false → 항상 false (PRD feature flag OFF 시나리오)', () => {
    expect(
      shouldEnforceNicknameOnboarding({
        user: { nickname: null },
        currentPath: '/',
        enforced: false,
      }),
    ).toBe(false);
  });

  it('enforced=true (default) → 정상 동작', () => {
    expect(
      shouldEnforceNicknameOnboarding({
        user: { nickname: null },
        currentPath: '/',
        enforced: true,
      }),
    ).toBe(true);
  });
});
