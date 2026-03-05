import { useState, useEffect } from 'react';
import { getSession, clearSession, getSteamLoginUrl, type Session } from './lib/auth';
import Homepage from './components/Homepage';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';
import './App.css';

type Route = 'home' | 'auth-callback' | 'dashboard';

function getRoute(): Route {
  const path = window.location.pathname;
  if (path.startsWith('/auth/callback')) return 'auth-callback';
  if (path.startsWith('/dashboard')) return 'dashboard';
  return 'home';
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function App() {
  const [route, setRoute] = useState<Route>(getRoute());
  const [session, setSession] = useState<Session | null>(getSession());

  useEffect(() => {
    const onNav = () => setRoute(getRoute());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  // If logged in and on home, redirect to dashboard
  useEffect(() => {
    if (session && route === 'home') {
      navigate('/dashboard');
    }
  }, [session, route]);

  const handleLogin = () => {
    window.location.href = getSteamLoginUrl();
  };

  const handleAuthSuccess = (s: Session) => {
    setSession(s);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    navigate('/');
  };

  if (route === 'auth-callback') {
    return (
      <div className="app">
        <AuthCallback
          onSuccess={handleAuthSuccess}
          onError={() => navigate('/')}
        />
      </div>
    );
  }

  if (route === 'dashboard' && session) {
    return (
      <div className="app">
        <Dashboard session={session} onLogout={handleLogout} />
      </div>
    );
  }

  // Not logged in or on home
  return (
    <div className="app">
      <Homepage onLogin={handleLogin} />
    </div>
  );
}

export default App;
