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
 * 401 발생 시 auth.get-it.cloud 로 redirect (SSO 회로). dev 에선 ?redirect= 로 돌아옴.
 */
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

setUnauthorizedHandler(() => {
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
