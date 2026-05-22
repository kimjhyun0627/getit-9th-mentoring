/**
 * OnboardingNicknamePage 테스트 — #557 자동추천 통합.
 *
 * 커버리지:
 *  - mount 시 /api/me + /api/auth/nickname-suggest 호출
 *  - placeholder 가 추천 닉네임으로 채워짐
 *  - 빈 submit → placeholder 추천이 updateNickname 에 전달됨
 *  - 직접 입력 → 입력값이 그대로 전달됨
 *  - 새로고침 버튼 클릭 시 다시 추천 fetch
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { OnboardingNicknamePage } from './OnboardingNicknamePage.jsx';

const renderPage = (initialEntry = '/onboarding/nickname') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <OnboardingNicknamePage />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

/** 기본 /api/me 응답 — nickname null 사용자 (onboarding 대상). */
const meNullNickname = () =>
  vi.spyOn(api, 'me').mockResolvedValue({
    data: { user: { id: 'u1', email: 'a@b.com', name: '홍길동', nickname: null } },
  });

describe('OnboardingNicknamePage (#557)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // window.location.replace stub — jsdom 기본은 navigation 차단.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, replace: vi.fn() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mount 시 /api/auth/nickname-suggest 호출 → placeholder 채워짐', async () => {
    meNullNickname();
    const suggestSpy = vi
      .spyOn(api, 'suggestNickname')
      .mockResolvedValue({ data: { suggested: '느긋한너구리' } });
    renderPage();
    await waitFor(() => {
      expect(suggestSpy).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '느긋한너구리');
    });
  });

  it('빈 submit → placeholder 추천이 updateNickname 에 전달됨', async () => {
    meNullNickname();
    vi.spyOn(api, 'suggestNickname').mockResolvedValue({
      data: { suggested: '춤추는로봇' },
    });
    const updateSpy = vi.spyOn(api, 'updateNickname').mockResolvedValue({ data: { ok: true } });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '춤추는로봇');
    });
    await user.click(screen.getByRole('button', { name: '저장하고 이어가기' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ nickname: '춤추는로봇' });
    });
  });

  it('직접 입력 시 입력값이 그대로 전달됨', async () => {
    meNullNickname();
    vi.spyOn(api, 'suggestNickname').mockResolvedValue({
      data: { suggested: '춤추는로봇' },
    });
    const updateSpy = vi.spyOn(api, 'updateNickname').mockResolvedValue({ data: { ok: true } });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '춤추는로봇');
    });
    await user.type(screen.getByLabelText('닉네임'), '내닉네임');
    await user.click(screen.getByRole('button', { name: '저장하고 이어가기' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({ nickname: '내닉네임' });
    });
  });

  it('새로고침 버튼 클릭 시 suggestNickname 재호출', async () => {
    meNullNickname();
    const suggestSpy = vi
      .spyOn(api, 'suggestNickname')
      .mockResolvedValueOnce({ data: { suggested: '느긋한너구리' } })
      .mockResolvedValueOnce({ data: { suggested: '춤추는로봇' } });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '느긋한너구리');
    });
    await user.click(screen.getByRole('button', { name: '다른 닉네임 추천 받기' }));
    await waitFor(() => {
      expect(suggestSpy).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '춤추는로봇');
    });
  });
});
