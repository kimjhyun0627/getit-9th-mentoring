/**
 * SchoolAuthGate 통합 테스트 (#562).
 *
 * 분기:
 *  - 로그인 + schoolVerifiedAt == null  → SchoolAuthRequired 안내 화면
 *  - 로그인 + schoolVerifiedAt != null  → children 그대로
 *  - 비로그인 (401)                     → children 그대로 (각 페이지가 자체 SSO 처리)
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { SchoolAuthGate } from './SchoolAuthGate.jsx';

const renderGate = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <SchoolAuthGate>
          <div data-testid="protected-child">PROTECTED</div>
        </SchoolAuthGate>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('SchoolAuthGate (#562)', () => {
  it('로그인 + 학교 미인증 — children 차단 + 안내 화면 노출', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-1',
      email: 'a@get-it.cloud',
      name: 'A',
      nickname: 'aaa',
      schoolVerifiedAt: null,
    });
    renderGate();
    await waitFor(() => {
      expect(screen.getByTestId('school-auth-required')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
  });

  it('로그인 + 학교 인증 완료 — children 통과 (회귀)', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-1',
      email: 'a@get-it.cloud',
      name: 'A',
      nickname: 'aaa',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    renderGate();
    await waitFor(() => {
      expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('school-auth-required')).not.toBeInTheDocument();
  });

  it('비로그인 (401) — children 통과 (각 페이지가 자체 SSO redirect)', async () => {
    const err = /** @type {any} */ (new Error('Unauthorized'));
    err.response = { status: 401 };
    vi.spyOn(api, 'getMe').mockRejectedValue(err);
    renderGate();
    await waitFor(() => {
      expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('school-auth-required')).not.toBeInTheDocument();
  });
});
