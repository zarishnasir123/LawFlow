import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import ClientRegisterForm from "./ClientRegisterForm";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";

// RouterProvider mounts asynchronously — wait for the form before touching it.
const waitForForm = () => screen.findByRole("button", { name: "Register" });

const submitBtn = () => screen.getByRole("button", { name: "Register" });

// The password inputs carry the native `required` attribute, so the browser's
// own constraint check blocks submission while they are empty (and React Hook
// Form never runs). Filling them is what lets RHF's own messages appear.
async function fillPasswords(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Password"), "Passw0rd!");
  await user.type(screen.getByLabelText("Confirm Password"), "Passw0rd!");
}

// Fill every field with valid values so a submit reaches the network.
async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("First Name"), "Zarish");
  await user.type(screen.getByLabelText("Last Name"), "Nasir");
  await user.type(screen.getByLabelText("Email Address"), "zarish@gmail.com");
  await user.type(screen.getByLabelText("Phone Number"), "3001234567");
  // The CNIC skeleton-mask input is registered under id="cnic".
  const cnic = document.getElementById("cnic") as HTMLInputElement;
  await user.type(cnic, "3410412345671");
  await fillPasswords(user);
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("ClientRegisterForm", () => {
  it("never reaches the network while the required passwords are empty", async () => {
    let called = false;
    server.use(
      http.post(api("/auth/register/client"), () => {
        called = true;
        return HttpResponse.json({ user: { email: "x" }, message: "ok" });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    await user.click(submitBtn());

    // The browser's native required check stops the submit outright.
    await new Promise((r) => setTimeout(r, 200));
    expect(called).toBe(false);
  });

  it("shows a required-field error for every empty field once passwords are filled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    await fillPasswords(user);
    await user.click(submitBtn());

    expect(await screen.findByText("First name is required.")).toBeInTheDocument();
    expect(screen.getByText("Last name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("CNIC number is required.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter a valid Pakistani mobile number.")
    ).toBeInTheDocument();
  });

  it("rejects a mismatched password confirmation", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Password"), "Passw0rd!");
    await user.type(screen.getByLabelText("Confirm Password"), "Different1!");
    await user.click(submitBtn());
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("enforces the password strength rules", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();

    const password = screen.getByLabelText("Password");
    await user.type(password, "allletters");
    expect(await screen.findByText("Include at least one number.")).toBeInTheDocument();

    await user.clear(password);
    await user.type(password, "letters12");
    expect(
      await screen.findByText("Include at least one special character.")
    ).toBeInTheDocument();

    await user.clear(password);
    await user.type(password, "Ab1!");
    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
  });

  it("rejects a badly formatted email", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    await user.type(screen.getByLabelText("Email Address"), "not-an-email");
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("sends the exact payload to the backend on a valid submit", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/register/client"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          user: { email: body.email },
          message: "Registered! Check your email for the code.",
          verification: { deliveryMode: "console" },
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    await fillValid(user);
    await user.click(submitBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      firstName: "Zarish",
      lastName: "Nasir",
      email: "zarish@gmail.com",
      phone: "+92-300-1234567",
      cnic: "34104-1234567-1",
      password: "Passw0rd!",
      confirmPassword: "Passw0rd!",
    });

    // Success stores the pending-verification email for the OTP screen.
    await waitFor(() =>
      expect(sessionStorage.getItem("lawflow_pending_verification_email")).toBe(
        "zarish@gmail.com"
      )
    );
  });

  it("surfaces a backend error message", async () => {
    server.use(
      http.post(api("/auth/register/client"), () =>
        HttpResponse.json({ message: "Email is already registered" }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    await fillValid(user);
    await user.click(submitBtn());
    expect(await screen.findByText("Email is already registered")).toBeInTheDocument();
  });

  it("blocks a non-Gujranwala CNIC", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientRegisterForm />);
    await waitForForm();
    const cnic = document.getElementById("cnic") as HTMLInputElement;
    await user.type(cnic, "3520212345671");
    await fillPasswords(user);
    await user.click(submitBtn());
    expect(
      await screen.findByText(/only to Gujranwala residents/i)
    ).toBeInTheDocument();
  });
});
