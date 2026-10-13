import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from './api';
import type { ClubSummary, User } from './types';

interface Me {
  user: User | null;
  club: ClubSummary | null;
}

interface AuthState extends Me {
  ready: boolean;
  setMe: (me: Me) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ user: null, club: null });
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>('/api/auth/me'));
    } catch {
      setMe({ user: null, club: null });
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    setUnauthorizedHandler(() => setMe({ user: null, club: null }));
  }, [refresh]);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setMe({ user: null, club: null });
  }, []);

  return <AuthContext.Provider value={{ ...me, ready, setMe, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** For pages that only render once signed in. */
export function useUser() {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}

export function homePath(role: User['role']) {
  return role === 'admin' ? '/admin' : role === 'club_admin' ? '/club' : '/';
}
