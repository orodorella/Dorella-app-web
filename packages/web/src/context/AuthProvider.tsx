'use client';

import { createContext, useContext, useReducer, useEffect, useState, useCallback, type ReactNode } from 'react';
import { type MappedUser } from '@/lib/api-client';
import { TIERS } from '@/lib/tiers';
import { authApi, onSessionInvalid, tryRefresh } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

interface AuthState {
  user: MappedUser | null;
}

type AuthAction =
  | { type: 'LOGIN'; payload: MappedUser }
  | { type: 'LOGOUT' }
  | { type: 'SET_TIER'; payload: string };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN':
      return { user: action.payload };
    case 'LOGOUT':
      return { user: null };
    case 'SET_TIER': {
      if (!state.user) return state;
      const tierInfo = TIERS[action.payload];
      if (!tierInfo) return state;
      return {
        user: { ...state.user, tier: action.payload, ...tierInfo },
      };
    }
    default:
      return state;
  }
}

interface AuthContextValue {
  user: MappedUser | null;
  sessionError: string;
  clearSessionError: () => void;
  tier: string;
  tierInfo: { label: string; descuento: number; minimo: number };
  TIERS: typeof TIERS;
  login: (email: string, password: string) => Promise<MappedUser>;
  register: (data: { nombre: string; email: string; password: string }) => Promise<MappedUser>;
  oauthGoogle: (data: { access_token: string; email: string; nombre: string }) => Promise<MappedUser>;
  updateProfile: (data: Record<string, string>) => Promise<MappedUser>;
  changePassword: (data: { passwordActual: string; passwordNueva: string }) => Promise<unknown>;
  logout: () => Promise<void>;
  setTier: (tier: string) => void;
  authDispatch: React.Dispatch<AuthAction>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, { user: null });
  const [restoring, setRestoring] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const clearSessionError = useCallback(() => setSessionError(''), []);
  const router = useRouter();

  useEffect(() => onSessionInvalid((wasAuthenticated) => {
    dispatch({ type: 'LOGOUT' });
    if (wasAuthenticated) {
      setSessionError('Sesi\u00f3n expirada');
      router.replace('/login');
    }
  }), [router]);

  useEffect(() => {
    authApi.me()
      .then((user) => { if (user) dispatch({ type: 'LOGIN', payload: user }); })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  // Silent refresh: the accessToken cookie (used by middleware to gate protected
  // routes) expires after 15 min. Rotate it in the background well before that so
  // an active session never gets bounced to /login mid-use.
  useEffect(() => {
    if (!state.user) return;
    const interval = setInterval(() => {
      void tryRefresh();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.user]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await authApi.login(email, password);
    setSessionError('');
    dispatch({ type: 'LOGIN', payload: user });
    return user;
  }, []);

  const register = useCallback(async (data: { nombre: string; email: string; password: string }) => {
    const user = await authApi.register(data);
    setSessionError('');
    dispatch({ type: 'LOGIN', payload: user });
    return user;
  }, []);

  const oauthGoogle = useCallback(async (data: { access_token: string; email: string; nombre: string }) => {
    const user = await authApi.oauthGoogle(data);
    setSessionError('');
    dispatch({ type: 'LOGIN', payload: user });
    return user;
  }, []);

  const updateProfile = useCallback(async (data: Record<string, string>) => {
    const user = await authApi.updateProfile(data);
    dispatch({ type: 'LOGIN', payload: user });
    return user;
  }, []);

  const changePassword = useCallback(async (data: { passwordActual: string; passwordNueva: string }) => {
    return authApi.changePassword(data);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setSessionError('');
    dispatch({ type: 'LOGOUT' });
  }, []);

  const setTier = useCallback((tier: string) => {
    dispatch({ type: 'SET_TIER', payload: tier });
  }, []);

  const tier = state.user?.tier || 'detal';
  const tierInfo = TIERS[tier] || TIERS.detal;

  if (restoring) return null;

  return (
    <AuthContext.Provider value={{
      user: state.user,
      sessionError,
      clearSessionError,
      tier,
      tierInfo,
      TIERS,
      login,
      register,
      oauthGoogle,
      updateProfile,
      changePassword,
      logout,
      setTier,
      authDispatch: dispatch,
    }}>
      {sessionError && <p role="alert" className="bg-red-50 p-3 text-center text-sm text-red-700">{sessionError}</p>}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
