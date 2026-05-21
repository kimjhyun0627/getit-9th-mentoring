import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.jsx';
import './index.css';
import { setUnauthorizedHandler } from './lib/api.js';

/**
 * React 19 + ThemeProvider + Router + QueryClient.
 *
 * 401 발생 시 auth.get-it.cloud 로 redirect (SSO 회로 — #252).
 * dev 환경에선 VITE_AUTH_URL 로 override 가능. 로그인 완료되면 ?redirect= 로 복귀.
 */
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

/**
 * #442 — SSO redirect race 가드.
 *
 * `/api/me` 401 과 `listMessages` (30s polling) 401 이 동시에 떨어지면
 * `window.location.replace` 가 두 번 호출되면서:
 *  - `?redirect=` 파라미터 인코딩이 깨지거나
 *  - 첫 history entry 가 덮어쓰여 뒤로가기 chain 이 끊김
 *  - SSO redirect-back 후 쿠키 reattach 실패 시 무한 loop
 *
 * module-level flag 로 첫 401 만 redirect 발화, 이후 401 은 무시.
 * 페이지가 unload 되면 자연스럽게 reset 되므로 별도 해제 로직 불필요.
 */
let isRedirecting = false;

setUnauthorizedHandler(() => {
  if (isRedirecting) return;
  isRedirecting = true;
  const here = encodeURIComponent(window.location.href);
  const authBase = import.meta.env?.VITE_AUTH_URL ?? 'https://auth.get-it.cloud';
  window.location.replace(`${authBase}/login?redirect=${here}`);
});

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
