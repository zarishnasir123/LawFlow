import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import ForgotPassword from "./ForgotPassword";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";

const waitForForm = () => screen.findByLabelText("Email Address");
const submitBtn = () =>
  screen.getByRole("button", { name: /Send Reset Link|Send|Reset/i });

describe("ForgotPassword", () => {
  it("sends the typed email to the backend", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/forgot-password"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "If your email is registered, a link was sent." });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.click(submitBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toEqual({ email: "zarish@gmail.com" });
  });

  it("shows the check-your-email confirmation after a successful request", async () => {
    server.use(
      http.post(api("/auth/forgot-password"), () => HttpResponse.json({ message: "ok" }))
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.click(submitBtn());

    expect(await screen.findByText(/Check Your Email/i)).toBeInTheDocument();
  });

  it("surfaces a backend error instead of the confirmation", async () => {
    server.use(
      http.post(api("/auth/forgot-password"), () =>
        HttpResponse.json({ message: "Too many reset requests. Try again later." }, { status: 429 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
    await user.click(submitBtn());

    expect(
      await screen.findByText("Too many reset requests. Try again later.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Check Your Email/i)).toBeNull();
  });

  it("requires an email before sending", async () => {
    let called = false;
    server.use(
      http.post(api("/auth/forgot-password"), () => {
        called = true;
        return HttpResponse.json({ message: "ok" });
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<ForgotPassword />);
    await waitForForm();
    await user.click(submitBtn());
    await new Promise((r) => setTimeout(r, 200));
    expect(called).toBe(false);
  });
});
