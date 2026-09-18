import type { MeResponse } from '@btech/shared';
import { useEffect, useState } from 'react';
import * as authApi from '../api/auth.api';
import { useAuth } from '../auth/AuthProvider';

export function HomePage() {
  const { withToken, logout } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    withToken(authApi.getMe)
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((err: unknown) => {
        // A 401 has already logged the user out; show other failures.
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load your profile');
      });
    return () => {
      cancelled = true;
    };
  }, [withToken]);

  return (
    <main className="card">
      {me && <h1>{me.message}</h1>}
      {!me && !error && <p>Loading…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">You will be logged out after 15 minutes of inactivity.</p>
      <button type="button" onClick={() => logout()}>
        Log out
      </button>
    </main>
  );
}
