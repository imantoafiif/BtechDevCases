import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  type LoginFormValues,
  type LoginInput,
} from "@btech/shared";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { applyApiError } from "../api/form-errors";
import { ApiError } from "../api/http";
import { useAuth } from "../auth/AuthProvider";
import { FormField } from "../../components/FormField";

const NOTICES: Record<string, string> = {
  registered: "Account created. Please log in.",
  idle: "You were logged out due to inactivity.",
  expired: "Your session has expired. Please log in again.",
};

export function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const noticeKey =
    searchParams.get("registered") === "1"
      ? "registered"
      : searchParams.get("reason");
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginInput) => {
    try {
      await login(values);
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
        setError("root", { message: "Invalid email or password." });
        return;
      }
      applyApiError(error, setError, ["email", "password"]);
    }
  };

  return (
    <main className="card">
      <h1>Log in</h1>
      {notice && <p className="notice">{notice}</p>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="switch">
        No account yet? <Link to="/register">Register</Link>
      </p>
    </main>
  );
}
