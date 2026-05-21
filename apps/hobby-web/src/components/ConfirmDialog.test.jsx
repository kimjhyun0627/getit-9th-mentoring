import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog.jsx';

/**
 * ConfirmDialog (#433) — Playful 톤 다이얼로그.
 *
 * 키 시나리오:
 *  - role=alertdialog, aria-labelledby 연결
 *  - ESC 닫기
 *  - 백드롭(outside) 클릭 닫기
 *  - 확인/취소 버튼 콜백
 *  - 처음 포커스가 cancel (destructive 시 의도적 안전 선택)
 *  - busy 시 두 버튼 disabled
 *  - 다크 / Playful 클래스 토큰 sanity check
 */

const Harness = ({ initial = true, destructive = true, onConfirm, onClose, busy = false }) => {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <ConfirmDialog
        open={open}
        title="모집을 종료할까?"
        description="신청자를 더 받지 못해."
        confirmLabel="종료"
        cancelLabel="취소"
        destructive={destructive}
        busy={busy}
        onConfirm={() => {
          onConfirm?.();
          setOpen(false);
        }}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      />
    </div>
  );
};

describe('ConfirmDialog', () => {
  it('open=false 면 렌더되지 않는다', () => {
    render(<ConfirmDialog open={false} title="x" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('role=alertdialog + 제목/설명 노출 + aria-labelledby/aria-describedby 연결', () => {
    render(<Harness />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    const title = document.getElementById(labelId);
    expect(title?.textContent).toMatch(/모집을 종료할까/);
    expect(screen.getByText('신청자를 더 받지 못해.')).toBeInTheDocument();
    // aria-describedby — description <p> id 와 연결돼야 a11y 보조기기가 본문 읽음
    const describeId = dialog.getAttribute('aria-describedby');
    expect(describeId).toBeTruthy();
    const desc = document.getElementById(describeId);
    expect(desc?.textContent).toBe('신청자를 더 받지 못해.');
  });

  it('ESC 키 → onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('백드롭(outside) 클릭 → onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    // 백드롭은 data-testid="confirm-backdrop"
    await user.click(screen.getByTestId('confirm-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('취소 버튼 → onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('확인 버튼 → onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: '종료' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('busy=true 면 두 버튼 모두 disabled + "처리 중…" 라벨', () => {
    render(<Harness busy />);
    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: /처리 중/ });
    expect(cancel).toBeDisabled();
    expect(confirm).toBeDisabled();
  });

  it('포커스 트랩: Tab 누르면 다이얼로그 내부 버튼들만 순환한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: '종료' });
    // 처음엔 cancel 에 포커스 (safe default for destructive)
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    // wrap around — 다이얼로그 밖으로 안 나감
    expect(cancel).toHaveFocus();
  });

  it('Playful 톤 클래스 토큰 — 다크 지원', () => {
    render(<Harness />);
    const dialog = screen.getByRole('alertdialog');
    // Playful: rounded-3xl + cream(amber) bg + dashed border
    expect(dialog.className).toMatch(/rounded-3xl/);
    expect(dialog.className).toMatch(/dark:/);
  });
});
