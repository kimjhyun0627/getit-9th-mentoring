import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { LoginPage } from './LoginPage.jsx';

/**
 * LoginPage TDD 가드 (Issue #11).
 * Red → Green → Refactor.
 */

const renderLogin = (initialEntry = '/login') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <LoginPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('email + password 필드와 로그인 버튼을 렌더한다', () => {
    renderLogin();
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('회원가입 페이지로 가는 링크가 있다', () => {
    renderLogin();
    const link = screen.getByRole('link', { name: /회원가입/ });
    expect(link).toHaveAttribute('href', '/signup');
  });

  it('빈 입력으로 submit 시 검증 에러 메시지를 보여준다', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText(/올바른 이메일 형식이 아닙니다/)).toBeInTheDocument();
    expect(await screen.findByText(/비밀번호는 8자 이상이어야 합니다/)).toBeInTheDocument();
  });

  it('잘못된 이메일 형식이면 에러를 보여준다', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText('이메일'), 'not-an-email');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText(/올바른 이메일 형식이 아닙니다/)).toBeInTheDocument();
  });

  it('정상 입력 시 api.login 을 호출한다', async () => {
    const user = userEvent.setup();
    const loginSpy = vi.spyOn(api, 'login').mockResolvedValue({ data: { ok: true } });
    renderLogin();
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough123');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({
        email: 'me@example.com',
        password: 'longenough123',
      });
    });
  });

  it('401 응답이면 사용자 친화 에러 메시지를 표시한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: 'Invalid credentials' } },
    });
    renderLogin();
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'wrongpass123');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeInTheDocument();
  });

  it('성공 시 ?redirect= 파라미터 URL로 이동한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'login').mockResolvedValue({ data: { ok: true } });
    const replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        replace: replaceSpy,
      },
    });
    renderLogin('/login?redirect=https%3A%2F%2Fhobby.get-it.cloud');
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough123');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('https://hobby.get-it.cloud');
    });
  });
});
