import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import PaymentPlanSetup from "./PaymentPlanSetup";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { server } from "../../../test/msw/server";
import { api } from "../../../test/msw/handlers";

const CASE_ID = "case-1";

// Minimal shape of the payment context the component consumes. The two flags
// (hasCategoryFee / hasPaymentPlan) gate which view renders.
const context = {
  hasCategoryFee: true,
  hasPaymentPlan: false,
  categoryFee: 30000,
  case: { clientName: "Ali Khan", title: "Khan property suit", caseCategory: "civil" as const },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const totalInput = () => screen.getAllByRole("spinbutton")[0] as HTMLInputElement;
const countInput = () => screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
const createBtn = () => screen.getByRole("button", { name: /Create Installments/i });

function open() {
  return renderWithProviders(<PaymentPlanSetup caseId={CASE_ID} context={context} />);
}

describe("PaymentPlanSetup", () => {
  it("pre-fills the total with the lawyer's configured case fee", async () => {
    open();
    await screen.findByText(/Total Case Amount/i);
    expect(totalInput().value).toBe("30000");
  });

  it("previews an equal split whose last installment absorbs the remainder", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText(/Total Case Amount/i);
    await user.clear(totalInput());
    await user.type(totalInput(), "10000");
    await user.clear(countInput());
    await user.type(countInput(), "3");

    // 10000 / 3 → 3333, 3333, 3334 — the preview table shows these amounts.
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/3,?333/);
      expect(body).toMatch(/3,?334/);
    });
  });

  it("sends the total, count, and per-installment due dates on submit", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(api(`/payments/lawyer/cases/${CASE_ID}/payment-plan`), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { agreement: { id: "p1" }, installments: [] } });
      })
    );

    const user = userEvent.setup();
    open();
    await screen.findByText(/Total Case Amount/i);
    await user.clear(totalInput());
    await user.type(totalInput(), "9000");
    await user.clear(countInput());
    await user.type(countInput(), "3");
    await user.click(createBtn());

    await waitFor(() => expect(body).not.toBeNull());
    const sent = body as unknown as { installments: unknown[] } & Record<string, unknown>;
    expect(sent).toMatchObject({ totalAmount: 9000, installmentCount: 3 });
    expect(Array.isArray(sent.installments)).toBe(true);
    expect(sent.installments.length).toBe(3);
  });

  it("rejects an installment count above 48", async () => {
    let called = false;
    server.use(
      http.post(api(`/payments/lawyer/cases/${CASE_ID}/payment-plan`), () => {
        called = true;
        return HttpResponse.json({ data: {} });
      })
    );

    const user = userEvent.setup();
    open();
    await screen.findByText(/Total Case Amount/i);
    await user.clear(countInput());
    await user.type(countInput(), "49");
    await user.click(createBtn());

    expect(await screen.findByText(/between 1 and 48/i)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 150));
    expect(called).toBe(false);
  });

  it("refuses a due date in the past", async () => {
    let called = false;
    server.use(
      http.post(api(`/payments/lawyer/cases/${CASE_ID}/payment-plan`), () => {
        called = true;
        return HttpResponse.json({ data: {} });
      })
    );

    const user = userEvent.setup();
    open();
    await screen.findByText(/Total Case Amount/i);
    await user.clear(totalInput());
    await user.type(totalInput(), "9000");
    await user.clear(countInput());
    await user.type(countInput(), "2");

    // Set the first installment's date to a clearly past date. fireEvent.change
    // is the reliable way to set a native date input's value in jsdom.
    const first = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(first, { target: { value: "2020-01-01" } });
    await user.click(createBtn());

    expect(await screen.findByText(/cannot be in the past/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });
});
