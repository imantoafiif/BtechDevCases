import type { AuthResponse, PublicUser } from "@btech/shared";

// localStorage (not sessionStorage) so every open tab shares the session and the idle timer.
export const SESSION_KEY = "auth.session";
export const LAST_ACTIVITY_KEY = "auth.lastActivityAt";

export interface Session {
  accessToken: string;
  user: PublicUser;
  receivedAt: number;
  expiresAt: number;
  idleTimeoutMs: number;
}

export function sessionFromAuthResponse(
  response: AuthResponse,
  now = Date.now(),
): Session {
  const lifetimeMs = response.expiresIn * 1000;
  return {
    accessToken: response.accessToken,
    user: response.user,
    receivedAt: now,
    expiresAt: now + lifetimeMs,
    idleTimeoutMs: lifetimeMs,
  };
}

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (
      typeof session.accessToken !== "string" ||
      typeof session.expiresAt !== "number"
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function writeSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function readLastActivity(): number | null {
  const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function writeLastActivity(timestamp: number) {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
}

/** True when the session can no longer be used: token expired or user idle too long. */
export function isSessionStale(session: Session, now = Date.now()) {
  const lastActivity = readLastActivity() ?? session.receivedAt;
  return (
    now >= session.expiresAt || now - lastActivity >= session.idleTimeoutMs
  );
}
