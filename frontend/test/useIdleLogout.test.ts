import { fireEvent, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeLastActivity } from '../src/auth/session-storage';
import { useIdleLogout } from '../src/auth/useIdleLogout';

const MINUTE = 60_000;
const TIMEOUT = 15 * MINUTE;

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T10:00:00Z'));
  });

  function renderIdle(onActivity = vi.fn()) {
    const onIdle = vi.fn();
    renderHook(() => useIdleLogout({ enabled: true, timeoutMs: TIMEOUT, onIdle, onActivity }));
    return { onIdle, onActivity };
  }

  it('calls onIdle after 15 minutes without activity', () => {
    writeLastActivity(Date.now());
    const { onIdle } = renderIdle();

    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('moves the deadline when the user is active', () => {
    writeLastActivity(Date.now());
    const { onIdle, onActivity } = renderIdle();

    vi.advanceTimersByTime(14 * MINUTE);
    fireEvent.pointerDown(window);
    expect(onActivity).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(14 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('counts activity recorded by another tab', () => {
    writeLastActivity(Date.now());
    const { onIdle } = renderIdle();

    vi.advanceTimersByTime(10 * MINUTE);
    writeLastActivity(Date.now()); // another tab saw activity

    vi.advanceTimersByTime(10 * MINUTE);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5 * MINUTE);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('throttles activity to once per second', () => {
    writeLastActivity(Date.now());
    const { onActivity } = renderIdle();

    fireEvent.keyDown(window);
    fireEvent.keyDown(window);
    fireEvent.scroll(window);
    expect(onActivity).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    fireEvent.keyDown(window);
    expect(onActivity).toHaveBeenCalledTimes(2);
  });

  it('logs out immediately when the last activity is already too old', () => {
    writeLastActivity(Date.now() - TIMEOUT - 1);
    const { onIdle } = renderIdle();
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('logs out on the first input after the computer wakes from sleep', () => {
    writeLastActivity(Date.now());
    const { onIdle, onActivity } = renderIdle();

    // Timers do not run during sleep; only the clock moves.
    vi.setSystemTime(Date.now() + 20 * MINUTE);
    fireEvent.pointerDown(window);

    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(onActivity).not.toHaveBeenCalled();
  });

  it('re-checks the deadline when the tab becomes visible', () => {
    writeLastActivity(Date.now());
    const { onIdle } = renderIdle();

    vi.setSystemTime(Date.now() + 20 * MINUTE);
    fireEvent(document, new Event('visibilitychange'));

    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
