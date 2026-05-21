import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import {
  COLUMNS,
  PROJECT,
  installDialogPolyfill,
  renderPage,
  stubHappyPath,
} from './BoardViewPage.test-helpers.jsx';

/**
 * BoardViewPage P1 멤버 다이얼로그 시나리오 — 본 파일 분리 (CR #403, 300줄 가이드).
 *
 * 관련 issue: #203 / #395 / #396 / #398
 */
describe('BoardViewPage P1 — 멤버 다이얼로그', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installDialogPolyfill();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SubHeader 의 "멤버 관리" 버튼 → MembersDialog 열림 (#203)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
          { userId: 'bob', role: 'MEMBER', name: null, joinedAt: '2026-05-02T00:00:00.000Z' },
        ],
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    expect(await screen.findByRole('heading', { name: '멤버 관리' })).toBeInTheDocument();
    expect(await screen.findByLabelText('초대할 userId')).toBeInTheDocument();
  });

  it('OWNER 가 새 userId 입력 후 초대 → POST /members 호출 (#203)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
        ],
      },
    });
    const inviteSpy = vi.spyOn(api, 'inviteMember').mockResolvedValue({
      data: { member: { userId: 'carol' } },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    await user.type(await screen.findByLabelText('초대할 userId'), 'carol');
    await user.click(screen.getByRole('button', { name: '초대' }));
    await waitFor(() => {
      expect(inviteSpy).toHaveBeenCalledWith('p1', { userId: 'carol' });
    });
  });

  it('내 ID 영역에 currentUserId + 복사 버튼이 보인다 (#396)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
        ],
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    await screen.findByRole('heading', { name: '멤버 관리' });
    const myIdRegion = screen.getByRole('region', { name: '내 ID' });
    expect(within(myIdRegion).getByText('alice', { selector: 'code' })).toBeInTheDocument();
    expect(within(myIdRegion).getByRole('button', { name: '내 ID 복사' })).toBeInTheDocument();
  });

  it('멤버 row 에 name 이 있으면 name 우선 + userid 보조표시 (#398)', async () => {
    const user = userEvent.setup();
    stubHappyPath();
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          {
            userId: 'alice',
            role: 'OWNER',
            name: '앨리스',
            joinedAt: '2026-05-01T00:00:00.000Z',
          },
          {
            userId: 'bob',
            role: 'MEMBER',
            name: '밥',
            joinedAt: '2026-05-02T00:00:00.000Z',
          },
        ],
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    const memberList = await screen.findByRole('region', { name: '멤버 목록' });
    // 이름은 sm 폰트 span — 정확 일치로 보조 aria-label 텍스트와 분리.
    expect(
      within(memberList).getByText('앨리스', { selector: 'span.text-sm' }),
    ).toBeInTheDocument();
    expect(within(memberList).getByText('밥', { selector: 'span.text-sm' })).toBeInTheDocument();
    // userid 보조 표시 — 폰트 mono span.
    expect(
      within(memberList).getByText('alice', { selector: 'span.font-mono' }),
    ).toBeInTheDocument();
    expect(within(memberList).getByText('bob', { selector: 'span.font-mono' })).toBeInTheDocument();
  });

  it('MEMBER role 일 때 초대 입력 폼은 없고 본인 탈퇴 버튼만 보인다 (#203)', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getProject').mockResolvedValue({
      data: { project: { ...PROJECT, role: 'MEMBER', currentUserId: 'bob' } },
    });
    vi.spyOn(api, 'listColumns').mockResolvedValue({ data: { columns: COLUMNS } });
    vi.spyOn(api, 'listCardsBatch').mockResolvedValue({ data: { cardsByColumn: {} } });
    vi.spyOn(api, 'listMembers').mockResolvedValue({
      data: {
        members: [
          { userId: 'alice', role: 'OWNER', name: null, joinedAt: '2026-05-01T00:00:00.000Z' },
          { userId: 'bob', role: 'MEMBER', name: null, joinedAt: '2026-05-02T00:00:00.000Z' },
        ],
      },
    });
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'GETIT board' });
    await user.click(screen.getByRole('button', { name: '멤버 관리' }));
    await screen.findByRole('heading', { name: '멤버 관리' });
    expect(screen.queryByLabelText('초대할 userId')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bob 탈퇴/ })).toBeInTheDocument();
    // alice (OWNER) 추방 버튼은 없음 — MEMBER 는 다른 사람 못 추방
    expect(screen.queryByRole('button', { name: /alice 추방/ })).not.toBeInTheDocument();
  });
});
