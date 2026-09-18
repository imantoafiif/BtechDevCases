export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

export const RENEW_MIN_TOKEN_AGE_MS = 60_000;

export const ACTIVITY_THROTTLE_MS = 1_000;
