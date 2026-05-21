import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { ForgotPasswordPage } from './ForgotPasswordPage.jsx';

/**
 * ForgotPasswordPage TDD 가드 (Issue #221).
 */
const renderForgot = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/forgot-password']}>
          <ForgotPasswordPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('ForgotPasswordPage', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('email 필드와 submit 버튼을 렌더한다', () => {
    renderForgot();
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '재설정 링크 보내기' })).toBeInTheDocument();
  });

  it('빈 입력으로 submit 시 검증 에러 메시지를 보여준다', async () => {
    const user = userEvent.setup();
    renderForgot();
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    expect(await screen.findByText(/올바른 이메일 형식이 아닙니다/)).toBeInTheDocument();
  });

  it('정상 입력 시 api.forgotPassword 를 호출하고 성공 메시지 + 이메일 표시 (#394)', async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(api, 'forgotPassword')
      .mockResolvedValue({ data: { ok: true, sent: true, email: 'me@example.com' } });
    renderForgot();
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ email: 'me@example.com' }));
    const success = await screen.findByTestId('forgot-success');
    expect(success).toBeInTheDocument();
    expect(success.textContent).toMatch(/me@example\.com/);
    expect(success.textContent).toMatch(/재설정 링크를 보냈습니다/);
    expect(success.textContent).toMatch(/메일을 확인해주세요/);
  });

  it('미등록 이메일 (404 EmailNotFound) → 분기 안내 + 가입 링크 표시 (#394)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'forgotPassword').mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { ok: false, error: 'EmailNotFound' } },
    });
    renderForgot();
    await user.type(screen.getByLabelText('이메일'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    const banner = await screen.findByTestId('forgot-not-found');
    expect(banner.textContent).toMatch(/등록되지 않은 이메일입니다/);
    expect(screen.getByRole('link', { name: /회원가입/ })).toHaveAttribute('href', '/signup');
    // 성공 화면으로 넘어가지 않음
    expect(screen.queryByTestId('forgot-success')).not.toBeInTheDocument();
  });

  it('dev 모드 응답에 token 이 있으면 보조 노출한다 (개발 디버그)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'forgotPassword').mockResolvedValue({
      data: { ok: true, sent: true, email: 'me@example.com', token: 'dev-token-abc' },
    });
    renderForgot();
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    const dev = await screen.findByTestId('dev-token');
    expect(dev.textContent).toMatch(/dev-token-abc/);
  });

  it('429 응답이면 사용자 친화 에러 메시지를 표시한다', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'forgotPassword').mockRejectedValue({
      isAxiosError: true,
      response: { status: 429 },
    });
    renderForgot();
    await user.type(screen.getByLabelText('이메일'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    expect(await screen.findByText(/잠시 후 다시 시도해주세요/)).toBeInTheDocument();
  });
});
