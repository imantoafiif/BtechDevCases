import type { AuthResponse } from '@btech/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../src/api/auth.api';
import { ApiError } from '../src/api/http';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { readSession } from '../src/auth/session-storage';

vi.mock('../src/api/auth.api');

function authResponse(token: string): AuthResponse {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 900,
    user: { id: 'user-1', email: 'jane@example.com' },
  };
}

let auth: ReturnType<typeof useAuth>;

function Probe() {
  const value = useAuth();
  useEffect(() => {
    auth = value;
  });
  return (
    <p>
      {value.session ? `token:${value.session.accessToken}` : 'logged out'}
      {value.logoutReason && ` reason:${value.logoutReason}`}
    </p>
  );
}

async function renderLoggedIn() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  vi.mocked(authApi.login).mockResolvedValue(authResponse('token-1'));
  await act(() => auth.login({ email: 'jane@example.com', password: 'secret123' }));
  expect(screen.getByText('token:token-1')).toBeInTheDocument();
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T10:00:00Z'));
    vi.mocked(authApi.renew).mockReset();
  });

  it('stores the session on login', async () => {
    await renderLoggedIn();
    expect(readSession()).toMatchObject({ accessToken: 'token-1', idleTimeoutMs: 900_000 });
  });

  it('does not renew on activity when the token is less than 60 seconds old', async () => {
    await renderLoggedIn();

    act(() => vi.advanceTimersByTime(30_000));
    fireEvent.pointerDown(window);

    expect(authApi.renew).not.toHaveBeenCalled();
  });

  it('renews once on activity when the token is older than 60 seconds', async () => {
    await renderLoggedIn();
    let resolveRenew!: (value: AuthResponse) => void;
    vi.mocked(authApi.renew).mockReturnValue(new Promise((resolve) => (resolveRenew = resolve)));

    act(() => vi.advanceTimersByTime(61_000));
    fireEvent.pointerDown(window);
    act(() => vi.advanceTimersByTime(1_000));
    fireEvent.keyDown(window); // while the first renew is still in flight

    expect(authApi.renew).toHaveBeenCalledTimes(1);
    expect(authApi.renew).toHaveBeenCalledWith('token-1');

    await act(async () => resolveRenew(authResponse('token-2')));
    expect(screen.getByText('token:token-2')).toBeInTheDocument();
    expect(readSession()?.accessToken).toBe('token-2');
  });

  it('logs out when a renew is rejected with 401', async () => {
    await renderLoggedIn();
    vi.mocked(authApi.renew).mockRejectedValue(new ApiError(401, 'TOKEN_EXPIRED', 'Expired'));

    act(() => vi.advanceTimersByTime(61_000));
    await act(async () => {
      fireEvent.pointerDown(window);
    });

    expect(screen.getByText('logged out reason:expired')).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('logs out after 15 minutes of inactivity', async () => {
    await renderLoggedIn();

    act(() => vi.advanceTimersByTime(15 * 60_000));

    expect(screen.getByText('logged out reason:idle')).toBeInTheDocument();
    expect(authApi.renew).not.toHaveBeenCalled();
  });

  it('logs out when an authenticated call returns 401', async () => {
    await renderLoggedIn();

    await act(async () => {
      await expect(
        auth.withToken(() => Promise.reject(new ApiError(401, 'UNAUTHORIZED', 'No'))),
      ).rejects.toThrow('No');
    });

    expect(screen.getByText('logged out reason:expired')).toBeInTheDocument();
  });
});
