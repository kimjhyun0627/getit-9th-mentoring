import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { VerifyEmailPage } from './VerifyEmailPage.jsx';

const renderPage = (path) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <VerifyEmailPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('VerifyEmailPage (#226)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('?token= 있으면 자동 verifyEmail 호출 + 성공 배너', async () => {
    const spy = vi.spyOn(api, 'verifyEmail').mockResolvedValue({ data: { ok: true } });
    renderPage(`/verify-email?token=${'a'.repeat(64)}`);
    await screen.findByText(/이메일이 인증되었습니다/);
    expect(spy).toHaveBeenCalled();
  });

  it('token 없으면 재발송 버튼 표시', () => {
    renderPage('/verify-email');
    expect(screen.getByRole('button', { name: '인증 메일 다시 받기' })).toBeInTheDocument();
  });
});
