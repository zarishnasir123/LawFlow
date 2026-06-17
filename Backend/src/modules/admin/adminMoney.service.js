import { pool } from "../../config/db.js";

// =====================================================================
// Admin money overview — the platform-wide picture of every rupee that has
// flowed through LawFlow's marketplace, for the admin Finances page.
//
// The core identity, true by construction (each successful payment's amount is
// split into platform_fee_amount + lawyer_net_amount at record time):
//   Collected = Platform fees + Net to lawyers
//   Net to lawyers = Paid out + Still owed
//   => Collected = Platform fees + Paid out + Still owed
//
// "Owed" is money LawFlow holds for lawyers but hasn't sent yet (covers both
// in-progress payouts and balances not yet requested). COALESCE on the split
// columns so any pre-commission rows still count their full amount as net.
// =====================================================================

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export async function getMoneyOverview() {
  const [txns, payouts, perLawyer] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(amount), 0)::float AS collected,
         COALESCE(SUM(COALESCE(platform_fee_amount, 0)), 0)::float AS platform_fees,
         COALESCE(SUM(COALESCE(lawyer_net_amount, amount)), 0)::float AS net_to_lawyers,
         COUNT(*)::int AS payments_count
       FROM payment_transactions
       WHERE status = 'success'`
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float AS paid_out,
         COALESCE(SUM(amount) FILTER (WHERE status IN ('requested','processing')), 0)::float
           AS in_progress,
         COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
         COUNT(*) FILTER (WHERE status IN ('requested','processing'))::int AS open_count
       FROM payouts`
    ),
    pool.query(
      `SELECT
         lu.id AS lawyer_user_id,
         CONCAT(lu.first_name, ' ', lu.last_name) AS lawyer_name,
         lu.email AS lawyer_email,
         t.gross::float AS gross,
         t.fee::float AS fee,
         t.net::float AS net,
         COALESCE(p.paid, 0)::float AS paid_out,
         COALESCE(p.in_progress, 0)::float AS in_progress
       FROM users lu
       JOIN (
         SELECT lawyer_user_id,
                SUM(amount) AS gross,
                SUM(COALESCE(platform_fee_amount, 0)) AS fee,
                SUM(COALESCE(lawyer_net_amount, amount)) AS net
         FROM payment_transactions
         WHERE status = 'success'
         GROUP BY lawyer_user_id
       ) t ON t.lawyer_user_id = lu.id
       LEFT JOIN (
         SELECT lawyer_user_id,
                SUM(amount) FILTER (WHERE status = 'paid') AS paid,
                SUM(amount) FILTER (WHERE status IN ('requested','processing')) AS in_progress
         FROM payouts
         GROUP BY lawyer_user_id
       ) p ON p.lawyer_user_id = lu.id
       ORDER BY t.net DESC`
    ),
  ]);

  const collected = round2(txns.rows[0].collected);
  const platformFees = round2(txns.rows[0].platform_fees);
  const netToLawyers = round2(txns.rows[0].net_to_lawyers);
  const paidOut = round2(payouts.rows[0].paid_out);
  const inProgressPayouts = round2(payouts.rows[0].in_progress);
  const owed = round2(netToLawyers - paidOut);

  return {
    totals: {
      collected,
      platformFees,
      netToLawyers,
      paidOut,
      inProgressPayouts,
      owed,
      paymentsCount: txns.rows[0].payments_count,
      paidPayoutsCount: payouts.rows[0].paid_count,
      openPayoutsCount: payouts.rows[0].open_count,
    },
    // Self-check shown on the page: the parts must add back up to the whole.
    reconciliation: {
      collected,
      platformFees,
      paidOut,
      owed,
      balances: Math.abs(collected - (platformFees + paidOut + owed)) < 0.01,
    },
    perLawyer: perLawyer.rows.map((r) => ({
      lawyerUserId: r.lawyer_user_id,
      lawyerName: r.lawyer_name,
      lawyerEmail: r.lawyer_email,
      grossEarned: round2(r.gross),
      platformFee: round2(r.fee),
      netEarned: round2(r.net),
      paidOut: round2(r.paid_out),
      inProgressPayouts: round2(r.in_progress),
      owed: round2(r.net - r.paid_out),
    })),
  };
}
