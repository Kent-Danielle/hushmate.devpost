import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './styles/fonts';
import './styles/tokens.css';
import './styles/global.css';
import App from './App';

// Theme: no data-theme = follow the device. Profile (a later slice) writes this key to override.
try {
  const theme = localStorage.getItem('hushmate-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // storage unavailable: follow the device
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
