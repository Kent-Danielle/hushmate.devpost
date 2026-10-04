import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/fonts';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';
import { queryClient } from './api/queryClient';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { registerServiceWorker } from './push/register';

// Theme: no data-theme = follow the device. Profile writes this same key to override.
try {
  const theme = localStorage.getItem('hushmate-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // storage unavailable: follow the device
}

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
