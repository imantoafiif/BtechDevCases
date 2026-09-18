import { useEffect, useRef } from "react";
import { ACTIVITY_THROTTLE_MS } from "../config";
import { readLastActivity, writeLastActivity } from "./session-storage";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
] as const;

interface IdleLogoutOptions {
  enabled: boolean;
  timeoutMs: number;
  onIdle: () => void;
  onActivity?: () => void;
}

export function useIdleLogout({
  enabled,
  timeoutMs,
  onIdle,
  onActivity,
}: IdleLogoutOptions) {
  const onIdleRef = useRef(onIdle);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onIdleRef.current = onIdle;
    onActivityRef.current = onActivity;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle = false;
    let lastRecordedAt = 0;

    const msUntilIdle = () => {
      const lastActivity = readLastActivity();
      return lastActivity === null ? 0 : lastActivity + timeoutMs - Date.now();
    };

    const goIdle = () => {
      if (idle) return;
      idle = true;
      clearTimeout(timer);
      onIdleRef.current();
    };

    const check = () => {
      const remaining = msUntilIdle();
      if (remaining <= 0) {
        goIdle();
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(check, remaining);
    };

    const handleActivity = () => {
      if (idle) return;
      const now = Date.now();
      if (now - lastRecordedAt < ACTIVITY_THROTTLE_MS) return;
      if (msUntilIdle() <= 0) {
        goIdle();
        return;
      }
      lastRecordedAt = now;
      writeLastActivity(now);
      onActivityRef.current?.();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") check();
    };

    if (readLastActivity() === null) writeLastActivity(Date.now());
    check();

    const listenerOptions = { capture: true, passive: true };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, listenerOptions);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", check);

    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity, listenerOptions);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", check);
    };
  }, [enabled, timeoutMs]);
}
