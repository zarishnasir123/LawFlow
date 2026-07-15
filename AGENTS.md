# AGENTS.md

Rules for AI agents and contributors working in this LawFlow repo.

## Monorepo layout

LawFlow is a **three-app monorepo**. Run everything from the repo root with
`npm run dev` (starts Backend `:5000`, Frontend `:5173`, Frontend-Admin `:5174`).

```text
LawFlow/
  Backend/           Node/Express API + WebSocket chat server
  Frontend/          Client, lawyer, registrar SPA (:5173)
  Frontend-Admin/    Admin-only SPA (:5174)
  AGENTS.md          this file — cross-cutting rules
  Frontend-AGENTS.md main-app rules
  Frontend-Admin-AGENTS.md admin-panel rules
```

Role-specific frontend rules live in the dedicated `*-AGENTS.md` files. When
they disagree with this file, the more specific file wins.

## Basic Rules

- Keep the folder names exactly as they are: `Backend`, `Frontend`, and `Frontend-Admin`.
- Do not mix frontend code with backend code.
- Do not over-engineer. Add abstractions only when they remove real duplication or make the code easier to maintain.
- Follow the existing code style and folder structure before creating a new pattern.
- Keep changes focused on the requested task.
- Do not rewrite unrelated files.

## Backend Structure

Backend code lives in `Backend/src`.

Use this layered structure:

```text
Backend/src/
  config/        app, database, and environment config
  middleware/    auth, RBAC, validation, and error middleware
  modules/       feature modules, grouped by domain
  services/      reusable external integrations like email
  utils/         reusable helpers
  app.js
  server.js
```

Current backend module architecture:

```text
Backend/src/
  config/           app, db, supabase
  middleware/       auth, RBAC, validation, rate limits, errors, uploads
  modules/
    auth/           registration, login, OTP, OAuth, password reset,
                    lawyer pending/active lists, review/suspend/reinstate,
                    CNIC OCR verification (cnicOcr.service.js, cnicOcr.parse.js)
    users/
    clients/        client-facing case reads
    lawyers/        public lawyer directory
    registrar/      registrar CRUD (admin-provisioned accounts)
    registrarReview/ registrar case queue (accept/return)
    cases/          case CRUD, submission, templates, audit events
    signatures/     per-signer requests + signed-PDF compiler
    hearings/       courtrooms, holidays, scheduling
    payments/       service charges, agreements, Safepay gateway, payouts
    chat/           one-to-one messaging
    ai/             lawyer AI legal assistant (Groq or Gemini)
    notifications/  in-app notifications + email preferences
    admin/          statistics, money dashboard, templates, case tracking
  realtime/         WebSocket chat server (/ws/chat)
  services/         email, storage, groq, gemini, llmHttp, disbursement,
                    activityTracker, case-templates
  models/           schema.sql (+ dated upgrade scripts when needed)
  seeders/          dev data helpers (e.g. fakeLawyers.js)
  scripts/          local verifyChunk*.js smoke tests (gitignored)
  app.js
  server.js
```

Do not create empty placeholder modules just to match this list. Add a module only when the feature is being implemented.

Feature modules should follow this pattern:

```text
modules/auth/
  auth.routes.js
  auth.controller.js
  auth.service.js
  auth.validators.js
```

Auth registration has an extra split:

```text
modules/auth/
  registration.service.js      shared registration workflow
  registration.strategies.js   role-specific profile mapping and creation
  cnicOcr.service.js           admin-triggered CNIC OCR on bar license cards
  cnicOcr.parse.js             pure CNIC extract/compare helpers (no Gemini/DB)
```

Shared LLM integrations live in `services/` — not inside feature modules:

```text
services/
  llmHttp.js        shared fetch + retry for Groq/Gemini (generic error messages)
  groq.service.js   chat completions (AI legal assistant)
  gemini.service.js text + vision (vision used for license-card OCR)
  storage.service.js  Supabase private buckets (lawyer docs, case files, avatars, chat)
  email.service.js    queued + synchronous SMTP delivery
```

**LLM error-message rule:** `llmHttp.js` is shared by the chatbot and OCR.
Keep its user-facing strings generic ("assistant is busy", "took too long").
OCR-specific copy belongs in `auth.controller.js` (`verifyLawyerCnic`) or
`cnicOcr.service.js`. Never map upstream provider 401 to HTTP 401 — use 502
so the admin panel's token-refresh interceptor does not log users out on a
bad API key.

Responsibilities:

- Routes only define endpoints and middleware.
- Validators check request input.
- Controllers handle request and response.
- Services contain business logic and database queries.
- Shared services contain reusable external integrations.
- Utils contain small reusable helpers.
- `registration.service.js` owns the shared registration pipeline, pending registration storage, OTP hashing, email queueing, verification, and user creation transaction.
- `registration.strategies.js` owns role-specific profile data mapping and profile table inserts.

Do not put database queries directly in route files.

## DRY Rules

- Do not copy/paste the same validation, SQL, hashing, token, or role-checking logic.
- Reuse helpers for CNIC validation, password hashing, JWT handling, async errors, and RBAC.
- Keep helpers small and easy to understand.
- Avoid generic helper functions that are not clearly needed yet.
- Local smoke tests: `Backend/src/scripts/verifyChunk*.js` are gitignored dev
  scripts. Add one when a feature needs repeatable verification without hitting
  external APIs (see `verifyChunkCnicOcr.js` for pure-parse OCR tests).

## Database Rules

- Use PostgreSQL with parameterized queries only.
- Never build SQL using user input string interpolation.
- Use transactions when writing to multiple related tables.
- Keep login identity in `users`.
- Keep role-specific data in profile tables like `client_profiles` and `lawyer_profiles`.
- Never store plain passwords, OTPs, reset tokens, or refresh tokens.
- Keep the ERD updated when tables, relationships, or cardinality change.
- Design tables to satisfy at least 3NF unless there is a measured, documented performance reason not to.
- Prefer foreign keys and lookup tables for reusable domain concepts instead of repeating the same text values across many tables.
- Do not duplicate facts across tables. Store each business fact in one owner table and join by key.
- Do not store derived values if they can be reliably calculated from normalized data, unless the denormalization is documented and tested.
- Add indexes for real query patterns, foreign-key joins, and common filters.
- Do not add duplicate indexes for `PRIMARY KEY` or `UNIQUE` columns because PostgreSQL already creates indexes for them.
- Review `EXPLAIN`/query plans before adding broad indexes or denormalizing data for performance.
- Keep schema changes in `Backend/src/models/schema.sql` for fresh installs.
- `schema.sql` is a clean drop-and-recreate script: running it wipes every row. Use it only for local dev and fresh Supabase setup.
- For incremental changes on databases that already have users, add a dated
  `YYYY-MM-DD_description.sql` next to `schema.sql` (idempotent). Once applied
  everywhere, fold the change into `schema.sql` and delete the upgrade script
  if the team only tracks the canonical schema going forward.
- `lawyer_profiles.cnic_verification_status` tracks CNIC OCR outcome:
  `not_checked` | `matched` | `mismatch` | `unreadable`. The admin UI keys off
  this column — not free-text in `cnic_match_remarks`.
- `users.cnic`, `users.phone`, and `users.password_hash` are nullable. Local registrants are required to provide CNIC and phone via the `registerClient` / `registerLawyer` validators; OAuth users do not have them at signup and may add them later via profile editing.
- Use the `auth_identities` table for OAuth provider linkage — one row per `(provider, provider_user_id)` pair. Never look up an OAuth user by email.
- Row Level Security is enabled on every public table by default with no policies. The Express backend bypasses RLS via `SUPABASE_SERVICE_ROLE_KEY`. The frontend never talks to Supabase REST directly. Add a policy only when a new role legitimately needs direct database access.

## Separation Of Concerns

- Frontend UI components should not contain backend business rules.
- Frontend API files should only call backend endpoints and map request/response data.
- Backend routes should only define endpoints and middleware order.
- Backend controllers should only translate HTTP requests/responses.
- Backend services should own business logic, transactions, and database queries.
- Middleware should stay focused on cross-cutting concerns such as auth, RBAC, validation, and errors.
- Shared utilities should be reusable and small; do not hide feature-specific business logic inside generic helpers.
- Keep UI state, server state, validation, API calls, and database writes in their proper layers.

## Auth And Roles

Supported roles:

```text
client
lawyer
registrar
admin
```

Rules:

- Clients and lawyers can self-register.
- Registrars are created by admin only.
- Never trust a role sent from the frontend.
- Read the user's real role from the database.
- Protect private routes with authentication middleware.
- Protect role-specific routes with RBAC middleware.
- Keep JWT payloads small.
- Do not put CNIC, phone, document URLs, case data, or signatures inside JWTs.

## Registrar credentials flow (admin-provisioned accounts)

Registrars never self-register. Admin creates the account; the server
generates a temporary password and emails it; the registrar is forced to
replace it on first sign-in.

Generation + storage rules:

- Generate the temporary password server-side with rejection-sampling over
  HTML-safe characters only. **Never** include `&`, `<`, `>`, `"`, or `'`
  in the temp-password charset — the credentials email runs through
  Handlebars and any HTML-special character gets entity-encoded, breaking
  bcrypt comparison when the registrar copies the displayed value.
- Persist `must_change_password = true` on the new user row. The flag is
  the gate that forces the registrar through `/change-temp-password`
  before they can use the dashboard. `changeAuthenticatedPassword` clears
  this flag and revokes the session in the same transaction.
- Email the plaintext password via the credentials template using
  triple-brace Handlebars (`{{{temporaryPassword}}}`) so the renderer
  cannot HTML-escape it. The defence above (HTML-safe charset) is the
  primary guard; the triple-brace is belt-and-braces.

Email delivery rules:

- The create-registrar happy path uses `queueRegistrarCredentialsEmail`
  (non-blocking, `setImmediate`). The admin's Create button must not
  block on Gmail's 5–8 second SMTP handshake.
- The explicit "Resend Credentials" action on the registrars list uses
  the synchronous `deliverRegistrarCredentialsEmail` — that path actively
  needs per-call SMTP feedback so the admin knows whether to retry.
- Treat **either** `emailSent === true` or `emailQueued === true` as
  success on the admin UI. Only when both are false does the
  "email NOT delivered" toast appear.
- Resending credentials rotates the password. Always confirm with the
  admin via a dialog before invoking the resend endpoint, because the
  rotation invalidates the previously emailed password immediately —
  including the one auto-sent at account creation.

Login flow on the frontend:

- The registrar login path posts to `/auth/login` with
  `expectedRole: "registrar"`, same as client and lawyer. There is no
  `/auth/login/registrar` endpoint and there never was.
- After a successful registrar login, the dashboard component must call
  `useEnforcePasswordChange()` (or equivalent) to redirect to
  `/change-temp-password` whenever `mustChangePassword === true`.
- The change-password endpoint revokes the session on success; the
  frontend must clear local auth and route to `/login`. The user signs
  in again with the new password.

## Lawyer verification and CNIC OCR

Lawyers self-register with degree PDF + bar license card images (front/back).
They start as `verification_status = 'pending'` and `account_status = 'inactive'`
until an admin approves them.

CNIC verification is **admin-triggered server-side OCR**, not client-side:

- Endpoint: `POST /api/auth/lawyers/:lawyerProfileId/verify-cnic`
- Gated: `authenticate` + `authorizeRoles("admin")` + `lawyerReviewLimiter`
- Service: `cnicOcr.service.js` downloads card images from Supabase private
  storage, calls `generateGeminiVision` (Gemini), parses the CNIC with
  `cnicOcr.parse.js`, compares digit-for-digit to `users.cnic`, persists
  `cnic_match`, `cnic_match_remarks`, and `cnic_verification_status`.
- Document scan order: back → front → combined. Stops early on match; keeps
  scanning after a readable mismatch in case the other side reads correctly.
- Registration does **not** accept client-supplied OCR results.

Approval/rejection (`PATCH .../review`) is separate from OCR. OCR is advisory
— it does not gate the Approve button. Reject still requires remarks.

Rejection deletes the user row (cascades profiles, documents, sessions) and
best-effort sweeps Supabase storage. Same email/CNIC/license can re-register.

`cnic_verification_status` values: `not_checked` | `matched` | `mismatch` |
`unreadable`. The admin UI keys off this column — not remark-string parsing.

Local logic tests: `node Backend/src/scripts/verifyChunkCnicOcr.js` (gitignored).
Requires `GEMINI_API_KEY` only for the live OCR path, not the parse script.

## OAuth (Google sign-in)

Only clients can sign in with Google. Lawyers, registrars, and admins use the local password flow only.

Identity rules:

- Match Google identities by `(auth_identities.provider, auth_identities.provider_user_id)`, never by email. Email ownership can change; the provider's stable subject id cannot.
- Never `ON CONFLICT (email) DO UPDATE` an OAuth row into an existing local-password account. If the email already exists locally, reject with a friendly error and ask the user to sign in with their password.
- OAuth user creation goes through the same `registration.service.js` / `registration.strategies.js` pipeline as local registration. The Google strategy is the `googleClient` key in `registration.strategies.js`.
- The Express backend always verifies the Supabase access token with `supabase.auth.getUser(token)` before trusting any user claim. Do not trust `id`, `email`, or metadata sent from the frontend.

Flow rules:

- Use an httpOnly `oauth_state` cookie set on `/auth/google` and verified on the session-creation step. This is the login-CSRF defence; do not skip it.
- Backend redirects Supabase straight to the frontend `/auth/callback`. The frontend reads the implicit-flow access token from the URL hash and POSTs it to `/api/auth/google/session` along with the state.
- Never log the OAuth `code`, `state`, Supabase access tokens, or user emails. They are tokens under the Security Rules.
- Use `requireSupabaseClient()` from `config/supabase.js`. Do not instantiate new Supabase clients ad-hoc.

## Document Editor

The lawyer's case document editor (`/lawyer-case-editor/:caseId`) renders Word documents via **docx-preview** directly into a contenteditable DOM tree. Not Tiptap, not mammoth → HTML, not any rich-text framework. The reason is fidelity: docx-preview preserves Word's exact page sizes, fonts, margins, table borders, paragraph alignment, list bullets, header/footer placement.

Rules:

- Keep the editor docx-preview based. Do not reintroduce Tiptap or any HTML-conversion renderer.
- The formatting invariant is non-negotiable: from first open through every edit, save, signature, reload, signing, and final PDF compile, the only visible change on a page should be the user's typed text, dropped image attachments, and signature overlays. Fonts / margins / page boundaries / tables / headers must stay byte-identical.
- The save format is the `.docx-wrapper`'s `outerHTML` plus docx-preview's injected `<style>` blocks, captured by `buildEditorSnapshot` in `Frontend/src/modules/lawyer/utils/editorSnapshot.ts`. Stored in `cases.edited_html`.
- The restore path in `DocxPreviewSurface.tsx` clones the `.docx-wrapper` only. Head `<style>` tags from the snapshot are deliberately skipped because they include viewer-iframe-framing CSS that flattens the editor's paper-on-desk look.
- Image attachments mount as absolutely-positioned spans via `Frontend/src/modules/lawyer/utils/floatingImage.ts` (Word's "In Front of Text" layout). They never reflow surrounding text. Don't switch to inline image flow.
- Auto-save runs on blur (500ms debounce), on a 30-second interval, and on the manual Save Draft button. All three call the same `persistEditedHtml` helper in `CaseDocumentEditor.tsx`. Don't add a fourth save path.

## Signature Flow

`signature_requests` is **one row per signer**. When both client and lawyer sign the same batch, that's two rows sharing a `case_batch_id`. Don't collapse them into a single row with two recipients.

Placement rules:

- The signer's placement is stored in `signature_placement` as a JSONB `{ pageIndex, xPct, yPct, widthPct, heightPct }`. Every coordinate is a **fraction between 0 and 1** relative to that section's rendered dimensions. Pixels are never stored — they don't survive the A4/Letter rescale at compile time.
- The compile multiplies these percentages by the actual PDF page width/height. Frontend overlay (`SignatureOverlayLayer.tsx`) multiplies by the section's getBoundingClientRect width/height. Same percentages, two coordinate spaces.

Rendering rules:

- The editor renders signed signatures live via `Frontend/src/modules/lawyer/components/documentEditor/SignatureOverlayLayer.tsx` — an `<img>` per signature, absolutely positioned over the matching section, `pointer-events: none`. The text underneath stays editable and unmodified.
- Never mutate `.docx-wrapper > section.docx > *` to "embed" the signature into the DOM tree. That breaks the formatting invariant and is incredibly hard to undo.

Compile rules:

- `Backend/src/modules/signatures/signatures.compiler.js` renders **each editor section as its own standalone PDF** and concatenates with pdf-lib. The earlier "render the whole document as A4 once" approach caused signature drift when section dimensions didn't match A4 — content re-flowed into PDF page N+1 and the signature landed on a blank trailing page. Don't fold this back into a single `page.pdf()` call.
- The compile fires inside `setImmediate(...)` from `submitSignature` so the signer's HTTP response returns in ~50ms instead of waiting 2–4 seconds for puppeteer. The lawyer's editor polls every 15 seconds and picks up `signed_pdf_storage_path` once the compile finishes. Don't switch to a synchronous compile.
- Email sends (signer-completion notification, deactivation confirmation, etc.) follow the same `setImmediate` rule. They never block the request that triggered them.

## AI legal assistant (lawyer-only)

- Module: `modules/ai/`. Lawyer-facing Q&A grounded in Pakistani civil/family law.
- Provider: `AI_PROVIDER` env (`groq` | `gemini`). Shared HTTP layer: `llmHttp.js`.
  Chat uses `groq.service.js` or `generateGeminiText`; license-card OCR uses
  `generateGeminiVision` only — do not route OCR through the chat endpoints.
- Rate limit: `aiGuidanceLimiter` on chat routes. OCR uses `lawyerReviewLimiter`
  on `/verify-cnic` — keep them separate.
- Sessions persist in `ai_chat_sessions` / `ai_chat_messages`.

## Profile And Account Lifecycle

Avatar storage:

- Avatar URLs returned from `/auth/me` are **signed Supabase URLs**, not public ones, with a 1-hour TTL. The bucket is private; the service role key bypasses RLS for the sign call. The shared helper is `getUserAvatarSignedUrl` in `Backend/src/services/storage.service.js`.
- A `?v=<updatedAt>` cache-bust is appended to the URL so the browser fetches a fresh image immediately after upload, even within the 1-hour window.
- The avatar editing UI lives only on the Edit Profile page. The View page renders the avatar read-only; do not add an upload affordance to the view page.

City and tehsil:

- `client_profiles.city` and `client_profiles.tehsil` are auto-derived from `address` by `deriveLocationFromAddress` in `Backend/src/utils/location.js` — last comma-separated segment for city, whole-word scan of `SUPPORTED_TEHSILS` for tehsil.
- Explicit values from the user (via the Edit Profile form) always win over the deriver.
- The PATCH `/auth/me` validator does NOT enforce "tehsil must be in `SUPPORTED_TEHSILS`". The strict check is registration-only, where it gates lawyer-side case routing. Don't tighten the PATCH validator without also extending the env list.

Self-deactivation and recovery:

- `DELETE /auth/me` stamps `users.deactivated_at = NOW()`, sets `account_status = 'inactive'`, deletes every refresh session, and queues a confirmation email — all in one transaction. The email goes out only after commit.
- On the next login attempt (password or Google), `handleSelfDeactivationRecovery` in `auth.service.js` checks the recovery window. Inside 30 days → backend returns `{ reactivationRequired, reactivationToken, deactivatedAt }` and the frontend shows the "Continue & Reactivate Account" dialog with a days-remaining countdown. Past 30 days → hard-delete the row (cascades to `client_profiles` and `auth_sessions`), respond 410.
- `account_status='inactive'` WITH `deactivated_at` set is self-deactivation. `inactive` WITHOUT `deactivated_at` is admin-imposed and goes through the existing "Contact support" gate. Don't conflate the two.
- The reactivation finalize is `POST /auth/reactivate` — no auth middleware; the short-lived JWT issued by the login response is the proof of identity. The token has `purpose: "reactivate"` so it can't be confused with access/refresh tokens.
- Call `handleSelfDeactivationRecovery` from both `loginUser` and `issueOAuthSession`. Don't duplicate the window math anywhere else.

## Security Rules

LawFlow handles private legal data, so security matters in every PR.

Always check:

- Request body validation exists.
- Passwords are hashed.
- Tokens and secrets are not logged.
- `.env` is not committed.
- SQL queries are parameterized.
- Users cannot access another user's private data.
- Role checks happen on the backend, not only the frontend.
- Sensitive data such as CNIC, legal documents, signatures, and tokens are not exposed in responses unless required.
- File storage for PDFs and signed documents must be private in future work.

Avoid logging:

```text
passwords
tokens
OAuth codes and access tokens
OAuth state values
CNICs
emails
private document URLs
case file contents
signatures
```

OAuth-specific security:

- Verify the OAuth `state` cookie on every callback (login-CSRF defence).
- Validate provider tokens server-side via `supabase.auth.getUser(token)` before trusting user identity.
- Keep `SUPABASE_SERVICE_ROLE_KEY` in the backend only. Never expose it to the frontend or commit it.
- Keep RLS enabled on every public table. Service role bypasses RLS; do not rely on backend-only writes as the security boundary if the anon key ever ships in the frontend.

## Error Handling

- Use centralized error handling.
- Return clean JSON errors.
- Do not expose stack traces to API users.
- Use correct HTTP status codes.

Example:

```json
{
  "message": "Email is already registered"
}
```

## Comments

- Add comments only when they explain business logic, security decisions, or non-obvious code.
- Do not add comments that simply repeat what the code already says.

## Pull Request Review Rules

When reviewing PRs, look for real risks first.

Review in this order:

1. Security issues
2. Authentication or authorization bugs
3. Data leaks or missing ownership checks
4. Broken database logic or missing transactions
5. Missing validation
6. Duplicate code
7. Maintainability and naming

Mention file and line references when possible.

Severity guide:

- Critical: auth bypass, secret leak, private data leak, destructive database bug.
- High: missing RBAC, unsafe SQL, plain-text credentials, missing ownership check.
- Medium: missing validation, weak error handling, transaction risk.
- Low: naming, formatting, minor cleanup.

If there are no issues, say that clearly and mention any testing gaps.

## Testing Rules

LawFlow uses three levels of automated testing plus documented manual test
cases. Every app owns its tests and they run independently.

Test stack:

```text
Backend/         Vitest + Supertest; tests in Backend/tests/{unit,integration}/
Frontend/        Vitest + React Testing Library + jsdom + MSW; tests colocated as src/**/*.test.ts(x)
Frontend-Admin/  same as Frontend
e2e/             Playwright system tests across all three apps (added later phase)
```

How to run (from each app folder):

- `npm test` — run everything for that app.
- `npm run test:unit` / `npm run test:integration` — Backend only.
- `npm run test:watch` — re-run on save while developing.
- `npm run coverage` (Backend) / `npm run test:coverage` (frontends) — coverage report.

Database safety (non-negotiable):

- Integration tests provision a throwaway database from `schema.sql`, which
  DROPS AND RECREATES EVERYTHING. Tests must never point at the real
  Supabase database.
- `Backend/tests/setup/guard.js` enforces this: `TEST_DATABASE_URL` must be
  set, must be localhost, must end in `_test` (or `_e2e`), must not contain
  `supabase`/`pooler`/`amazonaws`/`neon`/`render`, and must not equal the
  `DATABASE_URL` in `Backend/.env`. Never weaken or bypass the guard.
- Each developer keeps their local test DB URL in `Backend/.env.test.local`
  (gitignored). Example: `postgresql://postgres:<pw>@localhost:5432/lawflow_test`.

Test-case design standard:

- Every input gets valid, invalid, AND boundary values (equivalence
  partitioning + boundary value analysis). Example: password of exactly 8
  chars passes, 7 fails; installment count 1 and 48 pass, 0 and 49 fail.
- Test behavior through public seams (HTTP endpoints, rendered components,
  exported functions). Do not assert on SQL strings or implementation details.

External services are always faked in tests:

- Email → capture mock on `email.service.js` (OTPs are stored hashed, so
  capture-at-send is the only way to read them).
- Supabase storage → in-memory mock of `storage.service.js`.
- Safepay SDK, Groq/Gemini, DNS MX lookups → module mocks. Never call live
  services or use real keys in tests. CI runs with zero secrets.

Rules:

- New features and bug fixes must arrive with tests in the same PR.
- Tests run automatically on GitHub Actions for every push and PR
  (`.github/workflows/ci.yml`). A PR must be green before merge.
- Do not commit `.env.test.local`, coverage output, or Playwright reports.
- Frontend test files are excluded from the production build via
  `tsconfig.app.json` — keep new test files matching `src/**/*.test.ts(x)`.

## Git Rules

- Work on feature branches.
- Do not commit `node_modules`.
- Commit `package-lock.json` when dependencies change.
- Do not commit `.env`.
- Do not revert unrelated teammate or user changes.
