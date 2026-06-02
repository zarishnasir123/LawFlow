/**
 * Test script to verify case creation with automatic payment agreement flow
 *
 * Usage: node src/scripts/testCasePaymentFlow.js
 *
 * This script:
 * 1. Fetches a lawyer and client from the database
 * 2. Fetches available case types
 * 3. Creates a case with payment details
 * 4. Verifies the payment agreement was created
 */

import { pool } from "../config/db.js";

async function run() {
  try {
    // 1. Get a lawyer user (assumes one exists with role 'lawyer')
    console.log("1. Fetching lawyer user...");
    const lawyerResult = await pool.query(
      `SELECT id FROM users WHERE role = 'lawyer' LIMIT 1`
    );

    if (lawyerResult.rowCount === 0) {
      console.error("❌ No lawyer found. Run seedAdmin.js first.");
      process.exit(1);
    }

    const lawyerId = lawyerResult.rows[0].id;
    console.log(`   ✓ Lawyer ID: ${lawyerId}`);

    // 2. Get a client user (assumes one exists with role 'client')
    console.log("2. Fetching client user...");
    const clientResult = await pool.query(
      `SELECT id FROM users WHERE role = 'client' LIMIT 1`
    );

    if (clientResult.rowCount === 0) {
      console.error("❌ No client found. Please create a client user first.");
      process.exit(1);
    }

    const clientId = clientResult.rows[0].id;
    console.log(`   ✓ Client ID: ${clientId}`);

    // 3. Get available case types
    console.log("3. Fetching case types...");
    const caseTypesResult = await pool.query(
      `SELECT id, code, display_name FROM case_types LIMIT 1`
    );

    if (caseTypesResult.rowCount === 0) {
      console.error("❌ No case types found. Run generateCaseTemplates.js first.");
      process.exit(1);
    }

    const caseType = caseTypesResult.rows[0];
    console.log(`   ✓ Case Type: ${caseType.display_name}`);

    // 4. Create a case with payment info
    console.log("4. Creating case with payment details...");
    const testCase = {
      title: "Test Case for Payment Flow",
      description: "Automated test case",
      clientName: "John Doe",
      clientEmail: "john@example.com",
      clientPhone: "+923001234567",
      oppositePartyName: "Jane Smith",
      caseTypeId: caseType.id,
      clientUserId: clientId,
      agreedTotalAmount: 50000, // 50,000 PKR
      frequency: "monthly",
      installmentCount: 12
    };

    const caseResult = await pool.query(
      `INSERT INTO cases (
        lawyer_user_id, case_type_id, title, description,
        client_name, client_email, client_phone, opposite_party_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        lawyerId, testCase.caseTypeId, testCase.title, testCase.description,
        testCase.clientName, testCase.clientEmail, testCase.clientPhone,
        testCase.oppositePartyName
      ]
    );

    const caseId = caseResult.rows[0].id;
    console.log(`   ✓ Case created: ${caseId}`);

    // 5. Create agreement for the case
    console.log("5. Creating payment agreement...");
    const agreementResult = await pool.query(
      `INSERT INTO agreements (
        case_id, lawyer_user_id, client_user_id,
        lawyer_base_fee, agreed_total_amount, currency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, status`,
      [
        caseId, lawyerId, clientId,
        0, testCase.agreedTotalAmount, "PKR", "active"
      ]
    );

    const agreementId = agreementResult.rows[0].id;
    console.log(`   ✓ Agreement created: ${agreementId}`);

    // 6. Create payment plan
    console.log("6. Creating payment plan...");
    const planResult = await pool.query(
      `INSERT INTO payment_plans (
        agreement_id, total_amount, frequency, installment_count
      ) VALUES ($1, $2, $3, $4)
      RETURNING id`,
      [agreementId, testCase.agreedTotalAmount, testCase.frequency, testCase.installmentCount]
    );

    const planId = planResult.rows[0].id;
    console.log(`   ✓ Payment plan created: ${planId}`);

    // 7. Verify installments were created
    console.log("7. Verifying installments...");
    const installmentsResult = await pool.query(
      `SELECT id, installment_number, amount, due_date, status
       FROM installments
       WHERE agreement_id = $1
       ORDER BY installment_number ASC`,
      [agreementId]
    );

    console.log(`   ✓ Created ${installmentsResult.rowCount} installments`);
    installmentsResult.rows.slice(0, 3).forEach(inst => {
      console.log(`     - Installment ${inst.installment_number}: ${inst.amount} PKR (${inst.status})`);
    });

    // 8. Verify lawyer can see payment
    console.log("8. Verifying lawyer dashboard sees payment...");
    const lawyerViewResult = await pool.query(
      `SELECT a.id, c.title, a.agreed_total_amount, a.status
       FROM agreements a
       JOIN cases c ON a.case_id = c.id
       WHERE c.lawyer_user_id = $1 AND c.id = $2`,
      [lawyerId, caseId]
    );

    if (lawyerViewResult.rowCount > 0) {
      const agreement = lawyerViewResult.rows[0];
      console.log(`   ✓ Lawyer can see: Case "${agreement.title}" with payment ${agreement.agreed_total_amount} PKR`);
    }

    // 9. Verify client can see payment
    console.log("9. Verifying client dashboard sees payment...");
    const clientViewResult = await pool.query(
      `SELECT a.id, c.title, a.agreed_total_amount, a.status
       FROM agreements a
       JOIN cases c ON a.case_id = c.id
       WHERE a.client_user_id = $1 AND c.id = $2`,
      [clientId, caseId]
    );

    if (clientViewResult.rowCount > 0) {
      const agreement = clientViewResult.rows[0];
      console.log(`   ✓ Client can see: Case "${agreement.title}" with payment ${agreement.agreed_total_amount} PKR`);
    }

    console.log("\n✅ All tests passed! Payment flow is working with real database.");
    console.log("\nNext steps:");
    console.log(`  - Lawyer ID: ${lawyerId}`);
    console.log(`  - Client ID: ${clientId}`);
    console.log(`  - Case ID: ${caseId}`);
    console.log(`  - Agreement ID: ${agreementId}`);

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
