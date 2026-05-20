import { ThemeProvider } from '@getit/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App.jsx';
import './index.css';

/**
 * React 19 + ThemeProvider + Router + QueryClient.
 * 폼 위주 화면이라 retry 0, staleTime 0 (auth-web 과 동일).
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
