import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api } from '../lib/api';
import { User } from '../lib/types';
import { useToast } from '../components/ui/Toast';
import { Mail } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { success, error } = useToast();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (!credentialResponse.credential) {
      error('Failed to obtain credentials from Google login.');
      return;
    }
    
    try {
      const response = await api.loginWithGoogle(credentialResponse.credential);
      success(`Successfully logged in as ${response.user.name}`);
      onLoginSuccess(response.user);
    } catch (err: any) {
      error(err.message || 'Authentication with server failed.');
    }
  };

  const handleGoogleError = () => {
    error('Google Authentication failed.');
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
        
        {clientId && clientId !== 'your_google_client_id_here' ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="filled_black"
              shape="pill"
            />
          </div>
        ) : (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#f87171',
            textAlign: 'left',
            lineHeight: 1.4
          }}>
            <h4 style={{ fontWeight: 'bold', marginBottom: '0.4rem' }}>Google Client ID Required</h4>
            To enable Google Sign-In, please create a <code>.env</code> file in the <code>frontend</code> folder with your Client ID:
            <pre style={{ 
              marginTop: '0.5rem', 
              padding: '0.5rem', 
              background: 'rgba(0, 0, 0, 0.3)', 
              borderRadius: '4px',
              fontFamily: 'monospace',
              color: '#fff',
              fontSize: '0.75rem',
              overflowX: 'auto'
            }}>
              VITE_GOOGLE_CLIENT_ID=your_client_id_here
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
export default Login;
