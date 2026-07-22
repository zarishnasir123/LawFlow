import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import ResetPassword from "./ResetPassword";
import { renderRoute } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";

const TOKEN = "a".repeat(64);

const openWithToken = (token = TOKEN) =>
  renderRoute(ResetPassword, { path: "/reset-password", search: { token } });

const submitBtn = () => screen.getByRole("button", { name: /Reset Password|Update|Save/i });

describe("ResetPassword", () => {
  it("shows an invalid-link screen when the URL has no token", async () => {
    renderRoute(ResetPassword, { path: "/reset-password" });
    expect(await screen.findByText(/Invalid Link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("New Password")).toBeNull();
  });

  it("renders the password form when a token is present", async () => {
    openWithToken();
    expect(await screen.findByText(/Create New Password/i)).toBeInTheDocument();
  });

  it("strips the token from the browser URL so it cannot leak", async () => {
    openWithToken();
    await screen.findByText(/Create New Password/i);
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("sends the token with the new password", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/reset-password"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "Password updated" });
      })
    );

    const user = userEvent.setup();
    openWithToken();
    await screen.findByText(/Create New Password/i);

    const fields = screen.getAllByLabelText(/Password/i) as HTMLInputElement[];
    await user.type(fields[0], "NewPassw0rd!");
    await user.type(fields[1], "NewPassw0rd!");
    await user.click(submitBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      token: TOKEN,
      password: "NewPassw0rd!",
      confirmPassword: "NewPassw0rd!",
    });
  });

  it("shows the completion screen after a successful reset", async () => {
    server.use(
      http.post(api("/auth/reset-password"), () => HttpResponse.json({ message: "ok" }))
    );
    const user = userEvent.setup();
    openWithToken();
    await screen.findByText(/Create New Password/i);

    const fields = screen.getAllByLabelText(/Password/i) as HTMLInputElement[];
    await user.type(fields[0], "NewPassw0rd!");
    await user.type(fields[1], "NewPassw0rd!");
    await user.click(submitBtn());

    expect(await screen.findByText(/Password Reset Complete/i)).toBeInTheDocument();
  });

  it("surfaces an expired-token error from the backend", async () => {
    server.use(
      http.post(api("/auth/reset-password"), () =>
        HttpResponse.json({ message: "Reset link has expired" }, { status: 400 })
      )
    );
    const user = userEvent.setup();
    openWithToken();
    await screen.findByText(/Create New Password/i);

    const fields = screen.getAllByLabelText(/Password/i) as HTMLInputElement[];
    await user.type(fields[0], "NewPassw0rd!");
    await user.type(fields[1], "NewPassw0rd!");
    await user.click(submitBtn());

    expect(await screen.findByText("Reset link has expired")).toBeInTheDocument();
  });
});
