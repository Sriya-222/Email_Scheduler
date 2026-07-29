import React, { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../lib/api';
import { User } from '../lib/types';
import { useToast } from '../components/ui/Toast';
import { Mail, Loader2, Wifi, WifiOff } from 'lucide-react';

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'https://reachinbox-backend-923e.onrender.com/api').replace('/api', '');

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { success, error } = useToast();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [signingIn, setSigningIn] = useState(false);
  // 'unknown' | 'online' | 'offline'
  const [serverOnline, setServerOnline] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Background ping — shows status but NEVER blocks the sign-in button
  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        const resp = await fetch(`${BACKEND_URL}/health`, {
          // 35-second timeout — longer than Render's cold-start
          signal: AbortSignal.timeout ? AbortSignal.timeout(35_000) : undefined,
          cache: 'no-store',
        });
        if (!cancelled && resp.ok) {
          setServerOnline('online');
          // Stop pinging once confirmed online
          if (pingRef.current) clearInterval(pingRef.current);
        }
      } catch {
        if (!cancelled) setServerOnline('offline');
      }
    };

    // First ping immediately, then every 15 seconds
    ping();
    pingRef.current = setInterval(ping, 15_000);

    return () => {
      cancelled = true;
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      error('Could not get credentials from Google. Please try again.');
      return;
    }

    setSigningIn(true);
    try {
      const response = await api.loginWithGoogle(credentialResponse.credential);
      success(`Welcome, ${response.user.name}!`);
      onLoginSuccess(response.user);
    } catch (err: any) {
      setSigningIn(false);
      if (err.status === 0 || err.status === -1) {
        // Network / timeout error — server probably cold-starting
        setServerOnline('offline');
        error('Server is starting up. Please wait ~30 seconds and try again.');
      } else {
        error(err.message || 'Sign-in failed. Please try again.');
      }
    }
    // Note: don't setSigningIn(false) on success — component unmounts
  };

  const handleGoogleError = () => {
    error('Google sign-in was cancelled or failed. Please try again.');
  };

  // Status indicator — informational only, never blocks sign-in
  const statusDot = () => {
    if (serverOnline === 'online') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#34d399' }}>
          <Wifi size={13} /> Server ready
        </div>
      );
    }
    if (serverOnline === 'offline') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#fbbf24' }}>
          <WifiOff size={13} /> Server warming up — sign-in may take a moment
        </div>
      );
    }
    // unknown = checking
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…
      </div>
    );
  };

  return (
    <div className="login-page">
      <div className="login-card glass">
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Mail size={36} />
          </div>
        </div>

        <h1 className="login-title">ReachInbox</h1>
        <p className="login-desc">
          Schedule automated cold outreach campaigns with Redis-backed hourly caps, worker thread concurrency, and crash reconciliation.
        </p>

        {/* Server status — informational only */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
          {statusDot()}
        </div>

        {/* Sign-in area */}
        <div style={{ marginTop: '1.25rem' }}>
          {!clientId || clientId === 'your_google_client_id_here' ? (
            <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '0.85rem', color: '#f87171', textAlign: 'left', lineHeight: 1.5 }}>
              <strong>Setup required:</strong> Set <code>VITE_GOOGLE_CLIENT_ID</code> in your Vercel environment variables.
            </div>
          ) : signingIn ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Signing you in…</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                theme="filled_black"
                shape="pill"
                text="signin_with"
                size="large"
              />
              {serverOnline !== 'online' && (
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'center' }}>
                  You can sign in now — the server will respond even during startup
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Login;
