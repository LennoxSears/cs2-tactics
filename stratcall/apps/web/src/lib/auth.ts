const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SESSION_KEY = 'stratcall-session';

export interface Session {
  userId: string;
  steamId: string;
  displayName: string;
  avatarUrl: string | null;
  token: string;
}

export function getSession(): Session | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSteamLoginUrl(): string {
  const apiBase = API_BASE.replace(/\/api$/, '');
  return `${apiBase}/auth/steam?origin=${encodeURIComponent(window.location.origin)}`;
}

export async function handleSteamCallback(params: URLSearchParams): Promise<Session> {
  const apiBase = API_BASE.replace(/\/api$/, '');
  const res = await fetch(`${apiBase}/auth/steam/callback?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Auth failed' }));
    throw new Error((err as { error: string }).error);
  }
  const data = await res.json() as Session;
  // Use userId as token for now
  const session: Session = {
    ...data,
    token: data.userId,
  };
  setSession(session);
  return session;
}

export function getAuthHeaders(): Record<string, string> {
  const session = getSession();
  if (!session) return {};
  return {
    'Authorization': `Bearer ${session.token}`,
    'X-User-Id': session.userId,
  };
}
