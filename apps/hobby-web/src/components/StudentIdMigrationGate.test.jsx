/**
 * StudentIdMigrationGate 통합 테스트 — #573.
 *
 * 분기:
 *  - me.studentIdLegacy === true   → 모달 노출, children 그대로
 *  - me.studentIdLegacy === false  → 모달 X, children 그대로
 *  - me 키 누락                    → 모달 X (구버전 BE 호환)
 *  - 성공 submit                    → invalidateQueries(['me']) + 새로고침 후 모달 자동 닫힘
 *  - me 로딩 중                    → 모달 X (Gate 는 SchoolAuthGate 의 settled 후에만 동작)
 */
import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { StudentIdMigrationGate } from './StudentIdMigrationGate.jsx';

const renderGate = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <StudentIdMigrationGate>
          <div data-testid="protected-child">PROTECTED</div>
        </StudentIdMigrationGate>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

describe('StudentIdMigrationGate (#573)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('studentIdLegacy=true → 모달 노출 + children 도 함께 (blocking overlay)', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-1',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      studentIdLegacy: true,
    });
    renderGate();
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // children 은 마운트는 되어 있다 (라우터 안정성) — 모달이 시각적으로 가림.
    expect(screen.getByTestId('protected-child')).toBeInTheDocument();
  });

  it('studentIdLegacy=false → 모달 X', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-1',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      studentIdLegacy: false,
    });
    renderGate();
    await waitFor(() => {
      expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('studentIdLegacy 키 누락 → 모달 X (구버전 BE 호환)', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-1',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
    });
    renderGate();
    await waitFor(() => {
      expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('비로그인 (401) → 모달 X (SchoolAuthGate 가 상위에서 처리)', async () => {
    const err = /** @type {any} */ (new Error('Unauthorized'));
    err.response = { status: 401 };
    vi.spyOn(api, 'getMe').mockRejectedValue(err);
    renderGate();
    await waitFor(() => {
      expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('me 로딩 중 → 모달 X (아직 settled 안됨)', () => {
    vi.spyOn(api, 'getMe').mockReturnValue(new Promise(() => {}));
    renderGate();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('submit 성공 → updateStudentId 호출 + me invalidate → 모달 자동 닫힘', async () => {
    const user = userEvent.setup();
    const getMeSpy = vi.spyOn(api, 'getMe');
    // 1차: legacy=true. 2차 (invalidate 후): legacy=false.
    getMeSpy.mockResolvedValueOnce({
      id: 'u-1',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      studentIdLegacy: true,
    });
    getMeSpy.mockResolvedValue({
      id: 'u-1',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      studentIdLegacy: false,
    });
    const updateSpy = vi.spyOn(api, 'updateStudentId').mockResolvedValue(undefined);

    renderGate();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    expect(updateSpy).toHaveBeenCalledWith({ studentId: '2024111234' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('submit 실패 (5xx) → 모달 유지 + 에러 안내', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getMe').mockResolvedValue({
      id: 'u-1',
      schoolVerifiedAt: '2026-05-21T10:00:00.000Z',
      studentIdLegacy: true,
    });
    const err = /** @type {any} */ (new Error('Server Error'));
    err.response = { status: 500 };
    vi.spyOn(api, 'updateStudentId').mockRejectedValue(err);

    renderGate();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/잠시 후|일시/);
    });
    // 모달은 여전히 떠 있어야 함.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
