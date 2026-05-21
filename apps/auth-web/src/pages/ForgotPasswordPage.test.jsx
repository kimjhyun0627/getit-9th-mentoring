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

  it('성공 응답에 email 이 없어도 입력값으로 fallback 안내 (CR 회귀 가드)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'forgotPassword').mockResolvedValue({
      data: { ok: true, sent: true },
    });
    renderForgot();
    await user.type(screen.getByLabelText('이메일'), 'fallback@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    const success = await screen.findByTestId('forgot-success');
    expect(success.textContent).toMatch(/fallback@example\.com/);
    expect(success.textContent).toMatch(/재설정 링크를 보냈습니다/);
  });

  it('미등록 이메일 (200 sent:false) → 통합 success 화면 + 가입 CTA (#413/#417)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'forgotPassword').mockResolvedValue({
      data: { ok: true, sent: false, email: 'nobody@example.com' },
    });
    renderForgot();
    await user.type(screen.getByLabelText('이메일'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: '재설정 링크 보내기' }));
    // success 화면 안에 not-sent 안내 노출 — 외부 관측자는 등록 여부 식별 불가.
    const success = await screen.findByTestId('forgot-success');
    expect(success).toBeInTheDocument();
    const notSent = await screen.findByTestId('forgot-not-sent');
    expect(notSent.textContent).toMatch(/가입된 계정이 있다면/);
    expect(notSent.textContent).toMatch(/nobody@example\.com/);
    // dead-end 방지 CTA — 가입 페이지 링크 노출.
    expect(screen.getByRole('link', { name: /가입/ })).toHaveAttribute('href', '/signup');
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
