import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { AuthenticatedRedirect } from './AuthenticatedRedirect.jsx';

/**
 * AuthenticatedRedirect TDD 가드 (Issue #295).
 *
 * @param {{ entry: string, children: import('react').ReactNode }} props
 */
const Wrap = ({ entry, children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('AuthenticatedRedirect', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let replaceSpy;
  /** @type {object | undefined} */
  let originalLocation;

  beforeEach(() => {
    originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
    replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, replace: replaceSpy, hostname: 'auth.get-it.cloud' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLocation) Object.defineProperty(window, 'location', originalLocation);
  });

  it('로딩 중에는 checking session 표시', async () => {
    // me 호출은 절대 resolve 안 시켜서 loading 상태 고정
    vi.spyOn(api, 'me').mockReturnValue(new Promise(() => {}));
    render(
      <Wrap entry="/login">
        <AuthenticatedRedirect>
          <div>FORM</div>
        </AuthenticatedRedirect>
      </Wrap>,
    );
    expect(screen.getByText(/checking session/)).toBeInTheDocument();
  });

  it('401 (비로그인) → children 렌더', async () => {
    vi.spyOn(api, 'me').mockRejectedValue({
      isAxiosError: true,
      response: { status: 401 },
    });
    render(
      <Wrap entry="/login">
        <AuthenticatedRedirect>
          <div>FORM</div>
        </AuthenticatedRedirect>
      </Wrap>,
    );
    expect(await screen.findByText('FORM')).toBeInTheDocument();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('200 (로그인) + redirect 파라미터 없으면 landing 으로 이동', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({
      data: { user: { sub: 'u_1', email: 'a@b.com', name: 'A' } },
    });
    render(
      <Wrap entry="/login">
        <AuthenticatedRedirect>
          <div>FORM</div>
        </AuthenticatedRedirect>
      </Wrap>,
    );
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('https://get-it.cloud'));
    // children 은 렌더되지 않아야 함
    expect(screen.queryByText('FORM')).not.toBeInTheDocument();
  });

  it('200 (로그인) + ?redirect= 있으면 그 URL 로 이동 (화이트리스트)', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({
      data: { user: { sub: 'u_1', email: 'a@b.com', name: 'A' } },
    });
    render(
      <Wrap entry="/login?redirect=https%3A%2F%2Fhobby.get-it.cloud">
        <AuthenticatedRedirect>
          <div>FORM</div>
        </AuthenticatedRedirect>
      </Wrap>,
    );
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('https://hobby.get-it.cloud'));
  });

  it('200 (로그인) + 외부 호스트 ?redirect= 는 fallback 으로 (open redirect 방어)', async () => {
    vi.spyOn(api, 'me').mockResolvedValue({
      data: { user: { sub: 'u_1', email: 'a@b.com', name: 'A' } },
    });
    render(
      <Wrap entry="/login?redirect=https%3A%2F%2Fevil.com">
        <AuthenticatedRedirect>
          <div>FORM</div>
        </AuthenticatedRedirect>
      </Wrap>,
    );
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('https://get-it.cloud'));
  });
});
