export interface PublicUser {
  id: string;
  email: string;
  createdAt?: string;
}

export interface RegisterResponse {
  user: PublicUser;
}

/** Returned by POST /api/auth/login and POST /api/auth/refresh. */
export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Token lifetime in seconds. Also the inactivity timeout. */
  expiresIn: number;
  user: PublicUser;
}

export interface MeResponse {
  message: string;
  user: PublicUser;
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
}
