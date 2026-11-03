import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Helper to check if an error is an invalid/expired Supabase refresh token
function isRefreshTokenError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string'
    ? err
    : (err.message || err.error_description || err.error || err.msg || String(err));
  const isAuth = err.name === 'AuthApiError' || err.__isAuthError || err.status === 400;
  return (
    msg.includes('Invalid Refresh Token') ||
    msg.includes('Refresh Token Not Found') ||
    msg.includes('refresh_token_not_found') ||
    msg.includes('invalid_grant') ||
    (isAuth && msg.toLowerCase().includes('refresh token'))
  );
}

// Global purge for local auth tokens on stale session detection
function purgeLocalAuthTokens() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('-auth-token') || key.startsWith('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

// Shield console.error so Supabase GoTrueClient's internal console.error on expired refresh token
// does not trip the app error overlay or test harness
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const matches = args.some((arg) => isRefreshTokenError(arg));
  if (matches) {
    purgeLocalAuthTokens();
    console.warn('[Auth] Handled expired/invalid refresh token gracefully; purged stale storage.');
    return;
  }
  originalConsoleError.apply(console, args);
};

// Shield unhandled promise rejections for expired refresh tokens
window.addEventListener('unhandledrejection', (event) => {
  if (isRefreshTokenError(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation?.();
    purgeLocalAuthTokens();
    console.warn('[Auth] Handled unhandledrejection for expired refresh token.');
  }
});

// Shield window error events
window.addEventListener('error', (event) => {
  if (isRefreshTokenError(event.error) || isRefreshTokenError(event.message)) {
    event.preventDefault();
    event.stopImmediatePropagation?.();
    purgeLocalAuthTokens();
    console.warn('[Auth] Handled error event for expired refresh token.');
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

