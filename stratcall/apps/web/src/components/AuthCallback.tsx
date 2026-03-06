import { useEffect, useState } from 'react';
import { handleSteamCallback, type Session } from '../lib/auth';
import { useLocale } from '../lib/i18n';

interface Props {
  onSuccess: (session: Session) => void;
  onError?: (error: string) => void;
}

export default function AuthCallback({ onSuccess }: Props) {
  const { t } = useLocale();
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
      });
  }, []);

  return (
    <div className="auth-callback">
      {status === 'loading' && (
        <div className="auth-loading">
          <div className="auth-spinner" />
          <p>{t('auth.signingIn')}</p>
        </div>
      )}
      {status === 'error' && (
        <div className="auth-error">
          <p>{t('auth.loginFailed', { error: errorMsg })}</p>
          <button onClick={() => window.location.href = '/'}>{t('auth.backToHome')}</button>
        </div>
      )}
    </div>
  );
}
