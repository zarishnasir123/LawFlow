import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import LoginForm from "./LoginForm";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";
import { useLoginStore } from "../store";
import { getStoredAuthUser, getInMemoryAccessToken } from "../utils/authStorage";

const waitForForm = () => screen.findByRole("button", { name: "Login" });
const loginBtn = () => screen.getByRole("button", { name: "Login" });

const successBody = (role = "client") => ({
  accessToken: "access.token.here",
  refreshTokenExpiresAt: "2026-08-16T10:00:00.000Z",
  user: {
    id: "u1",
    email: "zarish@gmail.com",
    role,
    firstName: "Zarish",
    lastName: "Nasir",
  },
});

beforeEach(() => {
  // The login store is a module-level zustand store — reset it per test.
  useLoginStore.setState({ role: "client", email: "" });
  localStorage.clear();
  sessionStorage.clear();
});

describe("LoginForm", () => {
  it("shows the email required error once the password is filled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    // The password input is natively required, so fill it to let RHF run.
    await user.type(screen.getByLabelText("Password"), "Passw0rd!");
    await user.click(loginBtn());
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
  });

  it("rejects an email the app's stricter rule refuses (domain without a dot)", async () => {
    // "nope@x" satisfies the browser's built-in type=email check but fails the
    // app's own pattern, so this is the case where RHF's message surfaces.
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "nope@x");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!");
    await user.click(loginBtn());
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("sends the credentials with the client role and stores the session", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/login"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successBody("client"));
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!");
    await user.click(loginBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      email: "zarish@gmail.com",
      password: "Passw0rd!",
      rememberMe: false,
      expectedRole: "client",
    });

    // The session is saved and the access token is held in memory only.
    await waitFor(() => expect(getStoredAuthUser()?.email).toBe("zarish@gmail.com"));
    expect(getInMemoryAccessToken()).toBe("access.token.here");
  });

  it("honors the Remember me choice", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/login"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successBody("client"));
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!");
    await user.click(screen.getByLabelText("Remember me"));
    await user.click(loginBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ rememberMe: true });
    // rememberMe stores the user in localStorage (survives a browser restart).
    await waitFor(() => expect(localStorage.getItem("user")).toBeTruthy());
  });

  it("surfaces an invalid-credentials error", async () => {
    server.use(
      http.post(api("/auth/login"), () =>
        HttpResponse.json({ message: "Invalid email or password" }, { status: 401 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(loginBtn());
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("opens the reactivation dialog for a self-deactivated account and never stores a session", async () => {
    server.use(
      http.post(api("/auth/login"), () =>
        HttpResponse.json({
          reactivationRequired: true,
          reactivationToken: "reactivate.token",
          deactivatedAt: "2026-07-01T10:00:00.000Z",
        })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!");
    await user.click(loginBtn());

    expect(
      await screen.findByRole("button", { name: /Continue & Reactivate Account/ })
    ).toBeInTheDocument();
    // No tokens are saved until the user actually confirms reactivation.
    expect(getStoredAuthUser()).toBeNull();
    expect(getInMemoryAccessToken()).toBeNull();
  });

  it("lets the user switch to the Registrar role", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);
    await waitForForm();
    await user.click(screen.getByRole("button", { name: "Select Role" }));
    await user.click(screen.getByRole("option", { name: /Registrar/ }));
    expect(useLoginStore.getState().role).toBe("registrar");
  });
});
