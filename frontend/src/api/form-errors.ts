import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./http";

export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
) {
  if (error instanceof ApiError && error.details) {
    let matched = false;
    for (const [field, messages] of Object.entries(error.details)) {
      if ((fields as readonly string[]).includes(field) && messages[0]) {
        setError(field as Path<T>, { message: messages[0] });
        matched = true;
      }
    }
    if (matched) return;
  }
  const message =
    error instanceof ApiError
      ? error.message
      : "Something went wrong. Please try again.";
  setError("root", { message });
}
