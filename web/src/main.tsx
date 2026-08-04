import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { applyTheme, getStoredTheme } from './lib/theme';
import { applyDesign, getStoredDesign } from './lib/design';
import './i18n';
import './index.css';

applyTheme(getStoredTheme());
applyDesign(getStoredDesign());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Ma'lumot darhol "eskirgan" hisoblanadi — har sahifaga kirilganda,
      // tabga qaytilganda va internet tiklanganda yangisi olinadi. Shu tufayli
      // o'zgarishlar Ctrl+F5 bosmasdan ham darhol ko'rinadi.
      staleTime: 0,
      retry: 1,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
