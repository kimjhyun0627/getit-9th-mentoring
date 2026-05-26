/**
 * StudentIdMigrationModal 단위 테스트 — #573.
 *
 * Blocking 정책 + 검증 + 에러 분기 + a11y 회귀 가드.
 */
import { ThemeProvider } from '@getit/theme';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StudentIdMigrationModal } from './StudentIdMigrationModal.jsx';

const renderModal = ({ onSubmit = vi.fn(() => Promise.resolve()) } = {}) => {
  const result = render(
    <ThemeProvider>
      <StudentIdMigrationModal onSubmit={onSubmit} />
    </ThemeProvider>,
  );
  return { onSubmit, ...result };
};

describe('StudentIdMigrationModal (#573)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('role=dialog + aria-modal + 제목/안내 노출', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/학번 형식이 변경됐어요/)).toBeInTheDocument();
    expect(screen.getByText(/10자리로 변경됐어요/)).toBeInTheDocument();
  });

  it('input 은 type=tel + maxLength=10 + 숫자만 (KNU 학번 정책)', () => {
    renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('maxLength', '10');
    // pattern attr — 숫자만 (모바일 키패드 + native 검증)
    expect(input.getAttribute('pattern')).toMatch(/\\d/);
  });

  it('9자리 입력 시 submit 버튼 disabled + 검증 안내 (실시간)', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    await user.type(input, '202411123');
    const submit = screen.getByRole('button', { name: /저장/ });
    expect(submit).toBeDisabled();
    // 길이 힌트 — "(9/10)" 형식으로 노출 (label/description 의 "10자리" 와 별개)
    expect(screen.getByText(/9\/10/)).toBeInTheDocument();
  });

  it('11자리 입력 시도 — maxLength 로 10자리만 유지 + submit enabled', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    await user.type(input, '20241112345');
    // maxLength=10 — DOM 이 강제로 10자리까지만 받음
    expect(input.value.length).toBeLessThanOrEqual(10);
    const submit = screen.getByRole('button', { name: /저장/ });
    expect(submit).not.toBeDisabled();
  });

  it('10자리 입력 + submit → onSubmit({ studentId }) 호출', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    await user.type(input, '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));
    expect(onSubmit).toHaveBeenCalledWith({ studentId: '2024111234' });
  });

  it('문자 포함 입력 → 숫자만 남기고 무시 (paste 안전)', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    // 'a' / 'b' / 공백 / 하이픈 → 모두 필터링. 숫자 8개만 남음.
    await user.type(input, '2024 a 12-34 b');
    expect(input.value).toBe('20241234');
  });

  it('submit 중 — 두 번 클릭해도 onSubmit 은 한 번만 (이중 발사 차단)', async () => {
    const user = userEvent.setup();
    let resolveFn;
    const onSubmit = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );
    render(
      <ThemeProvider>
        <StudentIdMigrationModal onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    const submit = screen.getByRole('button', { name: /저장/ });
    await user.click(submit);
    // 로딩 상태 — disabled + label 변경
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveFn?.();
  });

  it('ESC 무효 — blocking 정책 (모달 안 사라짐)', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('배경 클릭 무효 — blocking 정책', async () => {
    const user = userEvent.setup();
    renderModal();
    // 백드롭은 data-testid="studentid-migration-backdrop"
    const backdrop = screen.getByTestId('studentid-migration-backdrop');
    await user.click(backdrop);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('400 응답 (zod 거부) → 학번 형식 에러 안내', async () => {
    const user = userEvent.setup();
    const err = /** @type {any} */ (new Error('Bad Request'));
    err.response = { status: 400, data: { error: 'ValidationError' } };
    const onSubmit = vi.fn(() => Promise.reject(err));
    render(
      <ThemeProvider>
        <StudentIdMigrationModal onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/학번/);
    });
  });

  it('401 응답 → 세션 만료 안내', async () => {
    const user = userEvent.setup();
    const err = /** @type {any} */ (new Error('Unauthorized'));
    err.response = { status: 401 };
    const onSubmit = vi.fn(() => Promise.reject(err));
    render(
      <ThemeProvider>
        <StudentIdMigrationModal onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/(다시 로그인|세션)/);
    });
  });

  it('403 SchoolNotVerified → 학교 인증 안내', async () => {
    const user = userEvent.setup();
    const err = /** @type {any} */ (new Error('Forbidden'));
    err.response = { status: 403, data: { error: 'SchoolNotVerified' } };
    const onSubmit = vi.fn(() => Promise.reject(err));
    render(
      <ThemeProvider>
        <StudentIdMigrationModal onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/학교 인증/);
    });
  });

  it('5xx 응답 → 일시 오류 안내 + 재시도 가능', async () => {
    const user = userEvent.setup();
    const err = /** @type {any} */ (new Error('Server Error'));
    err.response = { status: 500 };
    const onSubmit = vi.fn(() => Promise.reject(err));
    render(
      <ThemeProvider>
        <StudentIdMigrationModal onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    await user.type(screen.getByLabelText(/학번 \(10자리\)/), '2024111234');
    await user.click(screen.getByRole('button', { name: /저장/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/잠시 후|일시/);
    });
    // 재시도 가능 — submit enabled 로 복귀
    expect(screen.getByRole('button', { name: /저장/ })).not.toBeDisabled();
  });

  it('input 자동 포커스 — 키보드 사용자 한 번에 입력 시작', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByLabelText(/학번 \(10자리\)/)).toHaveFocus();
    });
  });

  it('focus trap: submit 이 disabled (검증 실패) 일 때도 Tab 이 input 에 고정 (Gemini #580 a11y)', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    const submit = screen.getByRole('button', { name: /저장/ });
    // 초기 상태: input 빈값 → submit disabled
    expect(submit).toBeDisabled();
    expect(input).toHaveFocus();
    // Tab → submit 이 disabled 라 브라우저가 모달 밖으로 탈출 시도 → 우리가 막아 input 고정
    await user.tab();
    expect(input).toHaveFocus();
    // Shift+Tab 도 동일하게 input 고정
    await user.tab({ shift: true });
    expect(input).toHaveFocus();
  });

  it('focus trap: 10자리 입력 후 submit enabled — 정상 순환', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByLabelText(/학번 \(10자리\)/);
    await user.type(input, '2024111234');
    const submit = screen.getByRole('button', { name: /저장/ });
    expect(submit).not.toBeDisabled();
    // input → Tab → submit
    input.focus();
    await user.tab();
    expect(submit).toHaveFocus();
    // submit → Tab → input (wrap around)
    await user.tab();
    expect(input).toHaveFocus();
  });
});
