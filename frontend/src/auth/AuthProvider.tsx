import type { LoginInput } from '@btech/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth.api';
import { ApiError } from '../api/http';
import { RENEW_MIN_TOKEN_AGE_MS } from '../config';
import {
  clearSession,
  isSessionStale,
  readSession,
  SESSION_KEY,
  sessionFromAuthResponse,
  writeLastActivity,
  writeSession,
  type Session,
} from './session-storage';
import { useIdleLogout } from './useIdleLogout';

export type LogoutReason = 'manual' | 'idle' | 'expired';

interface AuthContextValue {
  session: Session | null;
  /** Why the last logout happened, so the login page can explain it. */
  logoutReason: LogoutReason | null;
  login: (input: LoginInput) => Promise<void>;
  logout: (reason?: LogoutReason) => void;
  /** Runs an API call with the current token; a 401 logs the user out. */
  withToken: <T>(call: (token: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitialSession() {
  const session = readSession();
  if (session && isSessionStale(session)) {
    clearSession();
    return null;
  }
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadInitialSession);
  const [logoutReason, setLogoutReason] = useState<LogoutReason | null>(null);
  const sessionRef = useRef(session);
  const renewInFlight = useRef(false);

  const applySession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const logout = useCallback(
    (reason: LogoutReason = 'manual') => {
      clearSession();
      setLogoutReason(reason);
      applySession(null);
    },
    [applySession],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await authApi.login(input);
      const next = sessionFromAuthResponse(response);
      writeLastActivity(next.receivedAt);
      writeSession(next);
      setLogoutReason(null);
      applySession(next);
    },
    [applySession],
  );

  const renewIfNeeded = useCallback(() => {
    const current = sessionRef.current;
    if (!current || renewInFlight.current) return;
    if (Date.now() - current.receivedAt < RENEW_MIN_TOKEN_AGE_MS) return;

    renewInFlight.current = true;
    authApi
      .renew(current.accessToken)
      .then((response) => {
        // Ignore the result if the user logged out while the request was in flight.
        if (sessionRef.current?.accessToken !== current.accessToken) return;
        const next = sessionFromAuthResponse(response);
        writeSession(next);
        applySession(next);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) logout('expired');
        // Other failures (e.g. network): keep the current token and retry on the next activity.
      })
      .finally(() => {
        renewInFlight.current = false;
      });
  }, [applySession, logout]);

  const withToken = useCallback(
    async <T,>(call: (token: string) => Promise<T>): Promise<T> => {
      const current = sessionRef.current;
      if (!current) throw new ApiError(401, 'UNAUTHORIZED', 'You are not logged in');
      try {
        return await call(current.accessToken);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) logout('expired');
        throw error;
      }
    },
    [logout],
  );

  useIdleLogout({
    enabled: session !== null,
    timeoutMs: session?.idleTimeoutMs ?? 0,
    onIdle: () => logout('idle'),
    onActivity: renewIfNeeded,
  });

  // Keep tabs in sync: a login, renew or logout in another tab updates this one.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === null) applySession(readSession());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applySession]);

  const value = useMemo(
    () => ({ session, logoutReason, login, logout, withToken }),
    [session, logoutReason, login, logout, withToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
