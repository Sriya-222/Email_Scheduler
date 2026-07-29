import React, { useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../lib/api';
import { User } from '../lib/types';
import { useToast } from '../components/ui/Toast';
import { Mail, Loader2, Server } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://reachinbox-backend-923e.onrender.com/api';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

type ServerStatus = 'checking' | 'ready' | 'warming' | 'error';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { success, error } = useToast();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [signingIn, setSigningIn] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [retryCount, setRetryCount] = useState(0);

  // Ping backend health on mount — wake up Render free tier before user clicks Sign In
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10; // Try for up to ~50 seconds

    const pingHealth = async () => {
      while (attempts < maxAttempts && !cancelled) {
        try {
          const resp = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
            signal: AbortSignal.timeout(6000),
          });
          if (resp.ok && !cancelled) {
            setServerStatus('ready');
            return;
          }
        } catch {
          // Connection refused or timeout — backend still waking up
        }
        attempts++;
        if (!cancelled) {
          setServerStatus(attempts > 1 ? 'warming' : 'checking');
          await new Promise(r => setTimeout(r, 5000)); // Wait 5s between retries
        }
      }
      if (!cancelled) setServerStatus('error');
    };

    pingHealth();
    return () => { cancelled = true; };
  }, [retryCount]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      error('Failed to get Google credentials. Please try again.');
      return;
    }

    if (serverStatus !== 'ready') {
      error('Server is still warming up. Please wait a moment and try again.');
      return;
    }

    setSigningIn(true);
    try {
      const response = await api.loginWithGoogle(credentialResponse.credential);
      success(`Welcome, ${response.user.name}!`);
      onLoginSuccess(response.user);
    } catch (err: any) {
      const isNetworkErr = err.status === 0;
      if (isNetworkErr) {
        error('Server is warming up. Please wait 10 seconds and try again.');
        setServerStatus('warming');
        setRetryCount(c => c + 1);
      } else {
        error(err.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleError = () => {
    error('Google sign-in was cancelled or failed. Please try again.');
  };

  const statusBanner = () => {
    if (serverStatus === 'ready') return null;
    if (serverStatus === 'checking') {
      return (
        <div style={styles.statusBox('#1e3a5f', '#60a5fa')}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Connecting to server…
        </div>
      );
    }
    if (serverStatus === 'warming') {
      return (
        <div style={styles.statusBox('#1a2e1a', '#34d399')}>
          <Server size={14} />
          Server is warming up (~30 sec). Google sign-in will be enabled automatically.
        </div>
      );
    }
    if (serverStatus === 'error') {
      return (
        <div style={styles.statusBox('#2e1a1a', '#f87171')}>
          <Server size={14} />
          Server offline.{' '}
          <button
            onClick={() => setRetryCount(c => c + 1)}
            style={{ background: 'none', border: 'none', color: '#f87171', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}
          >
            Retry
          </button>
        </div>
      );
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            <Mail size={36} />
          </div>
        </div>

        <h1 className="login-title">ReachInbox</h1>
        <p className="login-desc">
          Schedule automated cold outreach campaigns with Redis-backed hourly caps, worker thread concurrency, and crash reconciliation.
        </p>

        {statusBanner()}

        {!clientId || clientId === 'your_google_client_id_here' ? (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', fontSize: '0.85rem', color: '#f87171', textAlign: 'left', lineHeight: 1.4 }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '0.4rem' }}>Google Client ID Missing</h4>
            Add <code>VITE_GOOGLE_CLIENT_ID</code> to your Vercel environment variables.
          </div>
        ) : signingIn ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '1.5rem', color: 'var(--text-secondary)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Signing you in…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', opacity: serverStatus === 'ready' ? 1 : 0.4, transition: 'opacity 0.4s', pointerEvents: serverStatus === 'ready' ? 'auto' : 'none' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_black"
              shape="pill"
              text="signin_with"
              size="large"
            />
            {serverStatus !== 'ready' && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Sign-in available once server is ready
              </span>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const styles = {
  statusBox: (bg: string, color: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0.9rem',
    background: bg,
    border: `1px solid ${color}33`,
    borderRadius: '8px',
    fontSize: '0.82rem',
    color,
    marginTop: '0.5rem',
  } as React.CSSProperties),
};

export default Login;
