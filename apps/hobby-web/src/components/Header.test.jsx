import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../lib/api.js';

import { Header } from './Header.jsx';

const renderHeader = (props = {}) => {
  const onSearchChange = props.onSearchChange ?? vi.fn();
  // 각 테스트 별로 fresh QueryClient — useQuery 캐시 격리.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <MemoryRouter>
          <Header search={props.search ?? ''} onSearchChange={onSearchChange} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  // 기본 동작: 비로그인 (NotificationBell / 마이 진입점 hidden).
  vi.spyOn(api, 'getMe').mockRejectedValue({ response: { status: 401 } });
});

describe('Header', () => {
  it('로고와 Sign in 링크를 렌더한다', () => {
    renderHeader();
    expect(screen.getByLabelText('취미메이트 홈')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in/ })).toBeInTheDocument();
  });

  it('검색 입력에 변경이 일어나면 onSearchChange 가 호출된다', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    renderHeader({ onSearchChange: spy });
    await user.type(screen.getByLabelText('태그 또는 장소로 검색'), '마');
    expect(spy).toHaveBeenLastCalledWith('마');
  });

  it('다크모드 토글 버튼이 보인다', () => {
    renderHeader();
    // PlayfulThemeToggle 은 role="switch" + 상태별 aria-label.
    expect(screen.getByRole('switch', { name: /(라이트|다크)모드로 전환/ })).toBeInTheDocument();
  });
});
