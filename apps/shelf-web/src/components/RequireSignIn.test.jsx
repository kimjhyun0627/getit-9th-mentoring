import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireSignIn } from './RequireSignIn.jsx';

/**
 * RequireSignIn — 401(비로그인) 상태에서 액션 카드 (PR #531).
 *
 * 검증:
 *  - 헤드라인 + 부제 + primary 버튼 노출
 *  - href: ${VITE_AUTH_URL or default}/login?redirect=<encoded current url>
 *  - VITE_AUTH_URL unset 시 https://auth.get-it.cloud 디폴트
 */
describe('RequireSignIn', () => {
  const ORIGINAL_LOCATION = window.location;

  beforeEach(() => {
    // window.location 을 mock — 테스트마다 분기 다르게.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'https://shelf.get-it.cloud/?utm=test' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: ORIGINAL_LOCATION,
    });
    vi.unstubAllEnvs();
  });

  it('헤드라인 + 부제 + "로그인하러 가기" 버튼을 렌더한다', () => {
    render(<RequireSignIn />);
    expect(screen.getByRole('heading', { name: /로그인이 필요해요/ })).toBeInTheDocument();
    expect(screen.getByText(/서가를 펼치려면/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /로그인하러 가기/ })).toBeInTheDocument();
  });

  it('VITE_AUTH_URL 미설정 시 https://auth.get-it.cloud 로 링크를 만든다', () => {
    vi.stubEnv('VITE_AUTH_URL', '');
    render(<RequireSignIn />);
    const link = screen.getByRole('link', { name: /로그인하러 가기/ });
    expect(link).toHaveAttribute(
      'href',
      `https://auth.get-it.cloud/login?redirect=${encodeURIComponent('https://shelf.get-it.cloud/?utm=test')}`,
    );
  });

  it('VITE_AUTH_URL 설정 시 해당 base 로 링크를 만든다', () => {
    vi.stubEnv('VITE_AUTH_URL', 'http://localhost:5174');
    render(<RequireSignIn />);
    const link = screen.getByRole('link', { name: /로그인하러 가기/ });
    expect(link).toHaveAttribute(
      'href',
      `http://localhost:5174/login?redirect=${encodeURIComponent('https://shelf.get-it.cloud/?utm=test')}`,
    );
  });

  it('redirect 쿼리는 current href 를 인코딩한다 (특수 문자 안전)', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: 'https://shelf.get-it.cloud/search?q=한 글&page=2' },
    });
    render(<RequireSignIn />);
    const link = screen.getByRole('link', { name: /로그인하러 가기/ });
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain(
      `redirect=${encodeURIComponent('https://shelf.get-it.cloud/search?q=한 글&page=2')}`,
    );
  });

  it('role="status" + aria-labelledby 로 비파괴 알림 처리 (role=status 가 polite 암시)', () => {
    render(<RequireSignIn />);
    const section = screen.getByRole('status');
    // role=status 가 암시적으로 polite live region 이므로 명시 aria-live 는 중복.
    expect(section).not.toHaveAttribute('aria-live');
    expect(section).toHaveAttribute('aria-labelledby', 'signin-card-title');
    expect(document.getElementById('signin-card-title')).not.toBeNull();
  });

  it('VITE_AUTH_URL 끝의 슬래시는 제거된다 (// 방지)', () => {
    vi.stubEnv('VITE_AUTH_URL', 'https://auth.get-it.cloud/');
    render(<RequireSignIn />);
    const link = screen.getByRole('link', { name: /로그인하러 가기/ });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('https://auth.get-it.cloud/login?')).toBe(true);
    expect(href).not.toContain('.cloud//login');
  });
});
