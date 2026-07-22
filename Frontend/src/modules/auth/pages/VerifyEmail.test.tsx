import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import VerifyEmail from "./VerifyEmail";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";

const PENDING_EMAIL = "zarish@gmail.com";
const digitBox = (n: number) => screen.getByLabelText(`OTP digit ${n}`) as HTMLInputElement;
const verifyBtn = () => screen.getByRole("button", { name: "Verify Email" });

beforeEach(() => {
  sessionStorage.clear();
  // The register step stores the pending email for this screen to read.
  sessionStorage.setItem("lawflow_pending_verification_email", PENDING_EMAIL);
});

describe("VerifyEmail (OTP screen)", () => {
  it("renders six single-digit boxes", async () => {
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");
    for (let i = 1; i <= 6; i++) {
      expect(digitBox(i)).toHaveAttribute("maxLength", "1");
    }
  });

  it("moves focus to the next box as each digit is typed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");

    await user.type(digitBox(1), "1");
    expect(digitBox(2)).toHaveFocus();
    await user.type(digitBox(2), "2");
    expect(digitBox(3)).toHaveFocus();
  });

  it("spreads a pasted 6-digit code across all boxes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");

    await user.click(digitBox(1));
    await user.paste("123456");

    await waitFor(() => expect(digitBox(6).value).toBe("6"));
    expect([1, 2, 3, 4, 5, 6].map((n) => digitBox(n).value).join("")).toBe("123456");
  });

  it("keeps the Verify button disabled until all six digits are entered", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");

    expect(verifyBtn()).toBeDisabled();
    await user.click(digitBox(1));
    await user.paste("12345");
    expect(verifyBtn()).toBeDisabled();

    await user.click(digitBox(1));
    await user.paste("123456");
    await waitFor(() => expect(verifyBtn()).toBeEnabled());
  });

  it("sends the joined code with the pending email", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api("/auth/verify-email"), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "Email verified" });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");
    await user.click(digitBox(1));
    await user.paste("123456");
    await waitFor(() => expect(verifyBtn()).toBeEnabled());
    await user.click(verifyBtn());

    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ email: PENDING_EMAIL, otp: "123456" });
  });

  it("surfaces a wrong-code error from the backend", async () => {
    server.use(
      http.post(api("/auth/verify-email"), () =>
        HttpResponse.json({ message: "Invalid or expired verification code" }, { status: 400 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");
    await user.click(digitBox(1));
    await user.paste("000000");
    await waitFor(() => expect(verifyBtn()).toBeEnabled());
    await user.click(verifyBtn());

    expect(
      await screen.findByText("Invalid or expired verification code")
    ).toBeInTheDocument();
  });

  it("requests a fresh code and clears the boxes when Resend is pressed", async () => {
    let resendCalls = 0;
    server.use(
      http.post(api("/auth/resend-verification-otp"), async () => {
        resendCalls += 1;
        return HttpResponse.json({ message: "A new code has been sent." });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");
    await user.click(digitBox(1));
    await user.paste("123456");

    await user.click(screen.getByRole("button", { name: /Resend Code/ }));

    await waitFor(() => expect(resendCalls).toBe(1));
    await waitFor(() => expect(digitBox(1).value).toBe(""));
    expect(await screen.findByText("A new code has been sent.")).toBeInTheDocument();
  });

  it("ignores non-digit characters", async () => {
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmail />);
    await screen.findByLabelText("OTP digit 1");
    await user.type(digitBox(1), "a");
    expect(digitBox(1).value).toBe("");
  });
});
