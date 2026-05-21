import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import {
  installDialogPolyfill,
  renderPage,
  stubHappyPath,
  todoCards,
} from './BoardViewPage.test-helpers.jsx';

/**
 * Phase 6b P1 가드 — 카드 편집 모달 / 담당자 picker / 같은-컬럼 reorder.
 *
 * 멤버 다이얼로그 시나리오는 BoardViewPage.members-dialog.test.jsx 로 분리 (CR #403).
 *
 * 관련 issue: #198 / #200 / #214 / #297
 */
describe('BoardViewPage P1 — 카드 편집 + reorder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installDialogPolyfill();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('카드 본문 클릭 → 편집 모달이 열린다 (#198)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 A 편집/ }));
    expect(await screen.findByRole('heading', { name: '카드 편집' })).toBeInTheDocument();
    expect(screen.getByLabelText('카드 제목')).toHaveValue('카드 A');
    expect(screen.getByLabelText('카드 설명')).toHaveValue('설명 A');
  });

  it('편집 모달에서 제목 수정 → PATCH 호출 + optimistic 반영 (#198)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const updateSpy = vi.spyOn(api, 'updateCard').mockResolvedValue({
      data: {
        card: {
          ...todoCards[0],
          title: '카드 A 수정',
        },
      },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 A 편집/ }));
    const titleInput = await screen.findByLabelText('카드 제목');
    await user.clear(titleInput);
    await user.type(titleInput, '카드 A 수정');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      // #253: updateCard 가 expectedUpdatedAt 도 함께 보내므로 partial match.
      expect(updateSpy).toHaveBeenCalledWith(
        'k1',
        expect.objectContaining({ title: '카드 A 수정' }),
      );
    });
    expect(updateSpy.mock.calls[0][1]).toHaveProperty('expectedUpdatedAt');
  });

  it('편집 모달에서 담당자 변경 → PATCH 호출에 assigneeId 포함 (#200)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const updateSpy = vi.spyOn(api, 'updateCard').mockResolvedValue({
      data: {
        card: { ...todoCards[0], assigneeId: 'bob' },
      },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    await user.click(within(todoRegion).getByRole('button', { name: /카드 A 편집/ }));
    await screen.findByRole('heading', { name: '카드 편집' });
    await user.click(screen.getByRole('button', { name: /담당자 선택/ }));
    await user.click(screen.getByRole('option', { name: /bob/ }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => {
      // #253: expectedUpdatedAt 가 추가되므로 partial match.
      expect(updateSpy).toHaveBeenCalledWith('k1', expect.objectContaining({ assigneeId: 'bob' }));
    });
  });

  it('같은 컬럼 안에서 위/아래 버튼으로 reorder → moveCard 호출에 order 포함 (#214)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    const moveSpy = vi.spyOn(api, 'moveCard').mockResolvedValue({
      data: { card: { ...todoCards[1], order: 500 } },
    });
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    // 카드 B 위로 이동 → A 와 B 사이 = 1500 이 아니라 A 앞 = 0... 실제로는 A 위로 이동
    await user.click(within(todoRegion).getByRole('button', { name: /카드 B 위로 이동/ }));
    await waitFor(() => {
      expect(moveSpy).toHaveBeenCalled();
    });
    const [calledCardId, payload] = moveSpy.mock.calls[0];
    expect(calledCardId).toBe('k2');
    expect(payload.columnId).toBe('c-todo');
    // A 위로 이동 → A 의 order(1000) 보다 작음
    expect(payload.order).toBeLessThan(1000);
  });

  it('맨 위 카드의 "위로 이동" 버튼은 disabled (#214)', async () => {
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    const upBtn = within(todoRegion).getByRole('button', { name: /카드 A 위로 이동/ });
    expect(upBtn).toBeDisabled();
  });

  it('맨 아래 카드의 "아래로 이동" 버튼은 disabled (#214)', async () => {
    stubHappyPath();
    renderPage();
    const todoRegion = await screen.findByRole('region', { name: /Todo 컬럼/ });
    const downBtn = within(todoRegion).getByRole('button', { name: /카드 C 아래로 이동/ });
    expect(downBtn).toBeDisabled();
  });
});
