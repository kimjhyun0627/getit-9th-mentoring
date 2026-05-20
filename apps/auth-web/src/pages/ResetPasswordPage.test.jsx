import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { ResetPasswordPage } from './ResetPasswordPage.jsx';

/**
 * ResetPasswordPage TDD 가드 (Issue #221).
 */
const VALID_TOKEN = 'a'.repeat(64);

const renderReset = (entry = `/reset-password?token=${VALID_TOKEN}`) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[entry]}>
          <ResetPasswordPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('새 비밀번호 + 확인 필드와 submit 버튼을 렌더한다', () => {
    renderReset();
    expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호 확인')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '비밀번호 변경' })).toBeInTheDocument();
  });

  it('URL 에 token 이 없으면 안내 메시지를 보여준다', () => {
    renderReset('/reset-password');
    expect(screen.getByText(/토큰이 없습니다/)).toBeInTheDocument();
  });

  it('약한 비밀번호 submit → 검증 에러', async () => {
    const user = userEvent.setup();
    renderReset();
    await user.type(screen.getByLabelText('새 비밀번호'), 'short');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'short');
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(await screen.findByText(/비밀번호는 8자 이상이어야 합니다/)).toBeInTheDocument();
  });

  it('passwordConfirm 불일치 → 검증 에러', async () => {
    const user = userEvent.setup();
    renderReset();
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword456');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'otherpassword');
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(await screen.findByText(/비밀번호 확인이 일치하지 않습니다/)).toBeInTheDocument();
  });

  it('정상 submit → api.resetPassword 호출 + 성공 화면', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'resetPassword').mockResolvedValue({ data: { ok: true } });
    renderReset();
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword456');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'newpassword456');
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        token: VALID_TOKEN,
        password: 'newpassword456',
        passwordConfirm: 'newpassword456',
      }),
    );
    expect(await screen.findByTestId('reset-success')).toBeInTheDocument();
  });

  it('400 응답이면 토큰 만료 안내', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'resetPassword').mockRejectedValue({
      isAxiosError: true,
      response: { status: 400 },
    });
    renderReset();
    await user.type(screen.getByLabelText('새 비밀번호'), 'newpassword456');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'newpassword456');
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(await screen.findByText(/토큰이 만료되었거나/)).toBeInTheDocument();
  });
});
