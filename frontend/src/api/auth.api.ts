import type {
  AuthResponse,
  LoginInput,
  MeResponse,
  RegisterInput,
  RegisterResponse,
} from "@btech/shared";
import { request } from "./http";

export function register(input: RegisterInput) {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function login(input: LoginInput) {
  return request<AuthResponse>("/auth/login", { method: "POST", body: input });
}

export function renew(token: string) {
  return request<AuthResponse>("/auth/refresh", { method: "POST", token });
}

export function getMe(token: string) {
  return request<MeResponse>("/me", { token });
}
