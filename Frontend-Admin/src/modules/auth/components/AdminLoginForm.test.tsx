import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import AdminLoginForm from "./AdminLoginForm";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";
import { getStoredAuthUser, getInMemoryAccessToken } from "../utils/authStorage";

const waitForForm = () => screen.findByRole("button", { name: "Login" });
const loginBtn = () => screen.getByRole("button", { name: "Login" });

const successBody = (role = "admin") => ({
  accessToken: "admin.access.token",
  refreshTokenExpiresAt: "2026-08-16T10:00:00.000Z",
  user: { id: "a1", email: "admin@lawflow.pk", role, firstName: "Admin", lastName: "User" },
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("AdminLoginForm", () => {
  it("requires an email before it will submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminLoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Password"), "Admin@123");
    await user.click(loginBtn());
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
  });

  it("always tags the request with the admin role", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/login"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(successBody("admin"));
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<AdminLoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "admin@lawflow.pk");
    await user.type(screen.getByLabelText("Password"), "Admin@123");
    await user.click(loginBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      email: "admin@lawflow.pk",
      password: "Admin@123",
      expectedRole: "admin",
    });

    await waitFor(() => expect(getStoredAuthUser()?.role).toBe("admin"));
    expect(getInMemoryAccessToken()).toBe("admin.access.token");
  });

  it("refuses to sign in a non-admin account even if the backend returned one", async () => {
    server.use(http.post(api("/auth/login"), () => HttpResponse.json(successBody("client"))));

    const user = userEvent.setup();
    renderWithProviders(<AdminLoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "client@lawflow.pk");
    await user.type(screen.getByLabelText("Password"), "Client@123");
    await user.click(loginBtn());

    // Defence-in-depth: no session is stored for a non-admin response.
    await new Promise((r) => setTimeout(r, 300));
    expect(getStoredAuthUser()).toBeNull();
    expect(getInMemoryAccessToken()).toBeNull();
  });

  it("surfaces an invalid-credentials error", async () => {
    server.use(
      http.post(api("/auth/login"), () =>
        HttpResponse.json({ message: "Invalid email or password" }, { status: 401 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<AdminLoginForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "admin@lawflow.pk");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(loginBtn());
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });
});
