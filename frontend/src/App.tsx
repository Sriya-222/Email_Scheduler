import React, { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { api, getToken, clearToken } from './lib/api';
import { User } from './lib/types';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Spinner } from './components/ui/Spinner';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  // null = still checking; false = checked, not logged in
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // No stored token — go straight to login, no network call needed
      setCheckingAuth(false);
      return;
    }

    // We have a token — verify it with the backend
    // Use a 10s timeout so cold-start doesn't hang the entire app
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    api.getCurrentUser()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        // Token expired, invalid, or server cold-starting → clear and show login
        clearToken();
        setUser(null);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setCheckingAuth(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleLogout = () => {
    api.logout(); // Fire-and-forget — always clear locally
    setUser(null);
  };

  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <Spinner />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Restoring your session…
        </span>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
};

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}
