import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.jsx';
import './index.css';

/**
 * React 19 + ThemeProvider + Router + QueryClient.
 * 리스트는 GET 위주라 staleTime 30s, retry 1 로 가볍게.
 */
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
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
