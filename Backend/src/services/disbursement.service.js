import { ApiError } from "../utils/apiError.js";

// ============================================================================
// Disbursement adapter — the single place LawFlow "sends" a lawyer's payout.
//
// In production, paying a lawyer means pushing money to their bank account.
// That is a regulated activity in Pakistan (it runs over RAAST / 1Link and
// needs a State Bank–licensed rail), and the Safepay account LawFlow uses for
// collection has no payouts API. So this build runs a *simulated* rail: it
// records a realistic payout instruction and returns success without moving
// real money. A real engine (RAAST / 1Link / a licensed aggregator) drops into
// the same disburse() slot later with no changes to its callers.
//
// The active engine is chosen by PAYOUT_DISBURSEMENT_MODE (default "simulated").
// ============================================================================

const MODE = (process.env.PAYOUT_DISBURSEMENT_MODE || "simulated").toLowerCase();

// 'YYYY-MM-DD' for today in the server's local time (matches how a payout's
// transfer_date is read back elsewhere — local parts, not toISOString).
function todayDateString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A unique-enough, human-readable reference for a payout, e.g.
// "LF-20260617-1532-4821". The LF prefix marks it as a LawFlow rail reference.
function makeReference() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate()
  )}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
  return `LF-${stamp}-${rand}`;
}

// Simulated rail: builds the same instruction payload a real payout API would
// receive, logs it (so it's visible in the server console during a demo), and
// returns a successful result. No real money moves.
function disburseSimulated({
  amount,
  currency,
  accountTitle,
  accountNumber,
  bankName,
  payoutId,
}) {
  const reference = makeReference();
  const payload = {
    amount: Math.round(Number(amount) * 100), // paisas, as a real rail expects
    currency: currency || "PKR",
    destination: {
      type: "bank_account",
      bank_name: bankName || null,
      account_number: accountNumber,
      account_name: accountTitle,
    },
    reference,
    metadata: { payoutId },
  };

  // The "show the judges the logs" moment — a realistic disbursement instruction.
  console.log(
    "[disbursement:simulated] POST /v1/payouts (sandbox) →",
    JSON.stringify(payload)
  );
  console.log(
    `[disbursement:simulated] ← status: success, reference: ${reference}`
  );

  return {
    provider: "simulated",
    reference,
    transferBank: "LawFlow Instant Payout (sandbox)",
    transferDate: todayDateString(),
  };
}

// Public entry point. Returns { provider, reference, transferBank, transferDate }
// which the caller stores on the payout when transitioning it to 'paid'.
export async function disburse(input) {
  const { accountNumber, accountTitle } = input;
  if (!accountNumber || !accountTitle) {
    // requestPayout already enforces this at request time; this is a defensive
    // second check so we never "send" to an incomplete destination.
    throw new ApiError(400, "The lawyer's payout bank account is incomplete.");
  }

  if (MODE === "simulated") {
    return disburseSimulated(input);
  }

  // Future: a real engine plugs in here, e.g.
  //   if (MODE === "raast") return disburseViaRaast(input);
  // It would call the licensed payout API and return the same shape.

  if (MODE === "manual") {
    throw new ApiError(
      409,
      "Disbursement mode is manual — record the transfer with the mark-paid form instead."
    );
  }

  throw new ApiError(
    500,
    `Unknown PAYOUT_DISBURSEMENT_MODE "${MODE}". Use "simulated" or "manual".`
  );
}
