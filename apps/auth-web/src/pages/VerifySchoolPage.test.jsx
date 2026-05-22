import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { VerifySchoolPage } from './VerifySchoolPage.jsx';

/**
 * VerifySchoolPage TDD (Issue #539) — 학번 검증 + 4 응답 코드 처리.
 */

// 32자 + 10자리 학번 길이 가 BE Zod 의 통과 기준. 테스트는 BE 응답만 mock — request body 는 그대로 전달.
const VALID_TOKEN = 'a'.repeat(40);

const renderVerify = (initialEntry = `/verify-school?token=${VALID_TOKEN}`) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/verify-school" element={<VerifySchoolPage />} />
            <Route path="/me" element={<div>MePage Mock</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('VerifySchoolPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상 토큰: 학번 입력 폼이 보인다', () => {
    renderVerify();
    expect(screen.getByLabelText('학번 (10자리)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '학교 인증 완료' })).toBeInTheDocument();
  });

  it('토큰 없음/너무 짧음: 만료 안내 + 마이페이지 링크 노출', () => {
    renderVerify('/verify-school'); // token 쿼리 없음
    expect(screen.getByText(/만료됐거나 이미 사용된 토큰/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /마이페이지로 가서 다시 받기/ })).toBeInTheDocument();
  });

  it('학번 형식 불일치 (9자리)는 폼 인라인 에러로 차단 (BE 호출 X)', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'verifySchool');
    renderVerify();
    await user.type(screen.getByLabelText('학번 (10자리)'), '123456789');
    await user.click(screen.getByRole('button', { name: '학교 인증 완료' }));
    expect(await screen.findByText('학번은 10자리 숫자입니다')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('학번 (8자리, 구 정책)도 폼 인라인 에러로 차단 — 회귀 방지', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'verifySchool');
    renderVerify();
    await user.type(screen.getByLabelText('학번 (10자리)'), '20241234');
    await user.click(screen.getByRole('button', { name: '학교 인증 완료' }));
    expect(await screen.findByText('학번은 10자리 숫자입니다')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('정상 입력 + 200 응답: 토큰/학번 포함 호출 + /me redirect', async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(api, 'verifySchool').mockResolvedValue({ data: { ok: true } });
    renderVerify();
    await user.type(screen.getByLabelText('학번 (10자리)'), '2024111234');
    await user.click(screen.getByRole('button', { name: '학교 인증 완료' }));
    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ token: VALID_TOKEN, studentId: '2024111234' });
    });
    await waitFor(
      () => {
        expect(screen.getByText('MePage Mock')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('400 InvalidToken 응답: 만료 안내로 전환', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'verifySchool').mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: 'InvalidToken' } },
    });
    renderVerify();
    await user.type(screen.getByLabelText('학번 (10자리)'), '2024111234');
    await user.click(screen.getByRole('button', { name: '학교 인증 완료' }));
    expect(await screen.findByText(/만료됐거나 이미 사용된 토큰/)).toBeInTheDocument();
  });

  it('409 SchoolEmailTaken 응답: 운영자 문의 안내로 전환', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'verifySchool').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: 'SchoolEmailTaken' } },
    });
    renderVerify();
    await user.type(screen.getByLabelText('학번 (10자리)'), '2024111234');
    await user.click(screen.getByRole('button', { name: '학교 인증 완료' }));
    expect(await screen.findByText(/다른 계정이 이미 인증한/)).toBeInTheDocument();
    expect(screen.getByText(/운영자에게 문의/)).toBeInTheDocument();
  });

  it('400 ValidationError (studentId 형식 오류 BE 측): 학번 인라인 에러', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'verifySchool').mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: 'ValidationError' } },
    });
    renderVerify();
    await user.type(screen.getByLabelText('학번 (10자리)'), '2024111234');
    await user.click(screen.getByRole('button', { name: '학교 인증 완료' }));
    expect(await screen.findByText(/학번이 올바르지 않아요/)).toBeInTheDocument();
  });
});
