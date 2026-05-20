import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { DeleteAccountPage } from './DeleteAccountPage.jsx';

/**
 * DeleteAccountPage smoke (#231) — currentPassword + "탈퇴" 확인 후 deleteAccount 호출.
 */
const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/delete-account']}>
          <DeleteAccountPage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('DeleteAccountPage (#231)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('"탈퇴" 외 다른 문구 입력 시 검증 에러', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('현재 비밀번호'), 'Pass1234');
    await user.type(screen.getByLabelText('"탈퇴" 라고 입력'), '아니오');
    await user.click(screen.getByRole('button', { name: '영구 탈퇴' }));
    expect(await screen.findByText(/"탈퇴" 를 정확히 입력/)).toBeInTheDocument();
  });

  it('정상 입력 시 deleteAccount 호출', async () => {
    const spy = vi.spyOn(api, 'deleteAccount').mockResolvedValue({ data: { ok: true } });
    const replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, replace: replaceSpy },
    });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('현재 비밀번호'), 'Pass1234');
    await user.type(screen.getByLabelText('"탈퇴" 라고 입력'), '탈퇴');
    await user.click(screen.getByRole('button', { name: '영구 탈퇴' }));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ currentPassword: 'Pass1234', confirm: '탈퇴' });
    });
  });
});
