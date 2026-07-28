import React, { useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { api } from './lib/api';
import { User } from './lib/types';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Spinner } from './components/ui/Spinner';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    api.getCurrentUser()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        // User not logged in, ignore error and show login
        setUser(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  if (checkingAuth) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Spinner />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Initializing session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
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
