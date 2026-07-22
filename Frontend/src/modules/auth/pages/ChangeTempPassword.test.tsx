import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import ChangeTempPassword from "./ChangeTempPassword";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";
import { getStoredAuthUser, saveStoredAuthUser } from "../utils/authStorage";

const current = () => screen.getByPlaceholderText(/temporary password/i);
const next = () => screen.getByPlaceholderText("Choose a new password");
const confirm = () => screen.getByPlaceholderText("Re-type the new password");
const updateBtn = () => screen.getByRole("button", { name: "Update Password" });
const waitForForm = () => screen.findByRole("button", { name: "Update Password" });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("ChangeTempPassword", () => {
  it("requires all three fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangeTempPassword />);
    await waitForForm();
    await user.click(updateBtn());
    expect(await screen.findByText("All three fields are required.")).toBeInTheDocument();
  });

  it("rejects a mismatched confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangeTempPassword />);
    await waitForForm();
    await user.type(current(), "Temp@123");
    await user.type(next(), "NewPass1!");
    await user.type(confirm(), "Different1!");
    await user.click(updateBtn());
    expect(
      await screen.findByText("New password and confirm password must match.")
    ).toBeInTheDocument();
  });

  it("refuses reusing the temporary password", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangeTempPassword />);
    await waitForForm();
    await user.type(current(), "Temp@123");
    await user.type(next(), "Temp@123");
    await user.type(confirm(), "Temp@123");
    await user.click(updateBtn());
    expect(
      await screen.findByText(/must be different from the temporary password/i)
    ).toBeInTheDocument();
  });

  it("enforces the password strength rule", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangeTempPassword />);
    await waitForForm();
    await user.type(current(), "Temp@123");
    await user.type(next(), "weakpass");
    await user.type(confirm(), "weakpass");
    await user.click(updateBtn());
    expect(
      await screen.findByText(/at least 8 characters and include one number/i)
    ).toBeInTheDocument();
  });

  it("submits, clears the session, and routes back to login on success", async () => {
    // Seed a logged-in registrar so we can prove the session gets wiped.
    saveStoredAuthUser({ id: "r1", email: "reg@lawflow.pk", role: "registrar" }, false, "tok");

    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/change-password"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "Password updated" });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<ChangeTempPassword />);
    await waitForForm();
    await user.type(current(), "Temp@123");
    await user.type(next(), "NewPass1!");
    await user.type(confirm(), "NewPass1!");
    await user.click(updateBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      currentPassword: "Temp@123",
      newPassword: "NewPass1!",
      confirmPassword: "NewPass1!",
    });

    // Local auth is wiped and the one-shot success banner flag is set.
    await waitFor(() => expect(getStoredAuthUser()).toBeNull());
    expect(sessionStorage.getItem("lawflow_password_change_success")).toBe("1");
  });

  it("surfaces a wrong-temporary-password error from the backend", async () => {
    server.use(
      http.post(api("/auth/change-password"), () =>
        HttpResponse.json({ message: "Current password is incorrect" }, { status: 400 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<ChangeTempPassword />);
    await waitForForm();
    await user.type(current(), "WrongTemp@1");
    await user.type(next(), "NewPass1!");
    await user.type(confirm(), "NewPass1!");
    await user.click(updateBtn());
    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });
});
