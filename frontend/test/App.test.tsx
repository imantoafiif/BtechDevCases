import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import * as authApi from "../src/api/auth.api";
import { ApiError } from "../src/api/http";
import App from "../src/App";
import { AuthProvider } from "../src/auth/AuthProvider";

vi.mock("../src/api/auth.api");

const user = { id: "user-1", email: "jane@example.com" };

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("register page", () => {
  it("shows validation errors without calling the API", async () => {
    renderApp("/register");

    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "different",
    );
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("shows a mismatch error on the confirm field", async () => {
    renderApp("/register");

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "secret124",
    );
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("shows the server error when the email is taken", async () => {
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(
        409,
        "EMAIL_TAKEN",
        "An account with this email already exists",
      ),
    );
    renderApp("/register");

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "secret123",
    );
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("An account with this email already exists"),
    ).toBeInTheDocument();
  });

  it("goes to the login page after registering", async () => {
    vi.mocked(authApi.register).mockResolvedValue({ user });
    renderApp("/register");

    await userEvent.type(screen.getByLabelText("Email"), "Jane@Example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "secret123",
    );
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("Account created. Please log in."),
    ).toBeInTheDocument();
    expect(authApi.register).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
  });
});

describe("login and protected page", () => {
  it("redirects to login when not logged in", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows the inactivity notice", () => {
    renderApp("/login?reason=idle");
    expect(
      screen.getByText("You were logged out due to inactivity."),
    ).toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password"),
    );
    renderApp("/login");

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
  });

  it("logs in, shows the welcome message, and logs out", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: "token-1",
      tokenType: "Bearer",
      expiresIn: 900,
      user,
    });
    vi.mocked(authApi.getMe).mockResolvedValue({
      message: "Hello jane@example.com, welcome back",
      user,
    });
    renderApp("/login");

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByRole("heading", {
        name: "Hello jane@example.com, welcome back",
      }),
    ).toBeInTheDocument();
    expect(authApi.getMe).toHaveBeenCalledWith("token-1");

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("returns to login with a notice when the token is rejected", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: "token-1",
      tokenType: "Bearer",
      expiresIn: 900,
      user,
    });
    vi.mocked(authApi.getMe).mockRejectedValue(
      new ApiError(401, "TOKEN_EXPIRED", "Expired"),
    );
    renderApp("/login");

    await userEvent.type(screen.getByLabelText("Email"), "jane@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByText("Your session has expired. Please log in again."),
    ).toBeInTheDocument();
  });
});
