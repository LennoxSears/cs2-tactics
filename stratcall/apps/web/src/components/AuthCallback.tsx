import { useEffect, useState } from 'react';
import { handleSteamCallback, type Session } from '../lib/auth';

interface Props {
  onSuccess: (session: Session) => void;
  onError?: (error: string) => void;
}

export default function AuthCallback({ onSuccess }: Props) {
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('openid.claimed_id')) {
      setStatus('error');
      setErrorMsg('Invalid callback — no Steam data received');
      return;
    }

    handleSteamCallback(params)
      .then(session => {
        console.log('Auth success:', session);
        onSuccess(session);
      })
      .catch(err => {
        console.error('Auth error:', err);
        setStatus('error');
        setErrorMsg(err.message || 'Authentication failed');
        // Don't auto-redirect on error — let user see the message
      });
  }, []);

  return (
    <div className="auth-callback">
      {status === 'loading' && (
        <div className="auth-loading">
          <div className="auth-spinner" />
          <p>Signing in with Steam...</p>
        </div>
      )}
      {status === 'error' && (
        <div className="auth-error">
          <p>Login failed: {errorMsg}</p>
          <button onClick={() => window.location.href = '/'}>Back to home</button>
        </div>
      )}
    </div>
  );
}
