import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { SignupPage } from './SignupPage.jsx';

/**
 * SignupPage TDD 가드 (Issue #11).
 */

const renderSignup = (initialEntry = '/signup') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <SignupPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

/**
 * 약관/개인정보 동의 체크박스 (Issue #237) 두 개를 한 번에 클릭하는 헬퍼.
 *
 * @param {ReturnType<typeof userEvent.setup>} user
 */
const acceptTermsAndPrivacy = async (user) => {
  const checkboxes = screen.getAllByRole('checkbox');
  for (const cb of checkboxes) {
    await user.click(cb);
  }
};

describe('SignupPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('name + email + password + passwordConfirm 필드와 회원가입 버튼을 렌더한다', () => {
    renderSignup();
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
  });

  it('로그인 페이지로 가는 링크가 있다', () => {
    renderSignup();
    const link = screen.getByRole('link', { name: /로그인/ });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('빈 입력으로 submit 시 검증 에러를 보여준다', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('이름을 입력해주세요')).toBeInTheDocument();
    expect(await screen.findByText(/올바른 이메일 형식이 아닙니다/)).toBeInTheDocument();
  });

  it('비밀번호 확인 mismatch 시 에러를 보여준다', async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(screen.getByLabelText('이름'), '김멘티');
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough123');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'different456');
    await user.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('비밀번호 확인이 일치하지 않습니다')).toBeInTheDocument();
  });

  it('정상 입력 시 api.signup 을 호출한다', async () => {
    const user = userEvent.setup();
    const signupSpy = vi.spyOn(api, 'signup').mockResolvedValue({ data: { ok: true } });
    renderSignup();
    await user.type(screen.getByLabelText('이름'), '김멘티');
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough123');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'longenough123');
    await acceptTermsAndPrivacy(user);
    await user.click(screen.getByRole('button', { name: '회원가입' }));
    await waitFor(() => {
      expect(signupSpy).toHaveBeenCalledWith({
        name: '김멘티',
        email: 'me@example.com',
        password: 'longenough123',
        passwordConfirm: 'longenough123',
        acceptTerms: true,
        acceptPrivacy: true,
      });
    });
  });

  it('409 (이메일 중복) 응답이면 사용자 친화 메시지를 표시한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'signup').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: 'EMAIL_TAKEN' } },
    });
    renderSignup();
    await user.type(screen.getByLabelText('이름'), '김멘티');
    await user.type(screen.getByLabelText('이메일'), 'taken@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough123');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'longenough123');
    await acceptTermsAndPrivacy(user);
    await user.click(screen.getByRole('button', { name: '회원가입' }));
    expect(await screen.findByText('이미 가입된 이메일입니다')).toBeInTheDocument();
  });

  it('회원가입 성공 시 ?redirect= 파라미터 URL로 이동한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'signup').mockResolvedValue({ data: { ok: true } });
    const replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        replace: replaceSpy,
      },
    });
    renderSignup('/signup?redirect=https%3A%2F%2Fshelf.get-it.cloud');
    await user.type(screen.getByLabelText('이름'), '김멘티');
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.type(screen.getByLabelText('비밀번호'), 'longenough123');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'longenough123');
    await acceptTermsAndPrivacy(user);
    await user.click(screen.getByRole('button', { name: '회원가입' }));
    await waitFor(
      () => {
        expect(replaceSpy).toHaveBeenCalledWith('https://shelf.get-it.cloud');
      },
      { timeout: 2000 },
    );
  });
});
