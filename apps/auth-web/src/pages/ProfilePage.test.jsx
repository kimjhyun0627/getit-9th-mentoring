import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { ProfilePage } from './ProfilePage.jsx';

/**
 * ProfilePage smoke (#235). me API mock 으로 폼이 채워지는지 + PATCH 호출되는지만.
 */

const renderProfile = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <ProfilePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('ProfilePage (#235)', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('me 로드 후 이름/이메일이 채워진다', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({
      data: { user: { sub: 'u1', email: 'me@x.com', name: '홍길동', emailVerifiedAt: null } },
    });
    renderProfile();
    expect(await screen.findByDisplayValue('홍길동')).toBeInTheDocument();
    expect(screen.getByDisplayValue('me@x.com')).toBeInTheDocument();
  });

  it('정상 입력 시 updateProfile 호출', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({
      data: {
        user: {
          sub: 'u1',
          email: 'me@x.com',
          name: '홍길동',
          emailVerifiedAt: new Date().toISOString(),
        },
      },
    });
    const spy = vi.spyOn(api, 'updateProfile').mockResolvedValue({ data: { ok: true } });
    const user = userEvent.setup();
    renderProfile();
    await screen.findByDisplayValue('홍길동');
    await user.type(screen.getByLabelText('현재 비밀번호 (확인)'), 'Curr1234');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({
        name: '홍길동',
        email: 'me@x.com',
        currentPassword: 'Curr1234',
      });
    });
  });
});
