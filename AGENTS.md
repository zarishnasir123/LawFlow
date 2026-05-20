# AGENTS.md

Rules for AI agents and contributors working in this LawFlow repo.

## Basic Rules

- Keep the folder names exactly as they are: `Backend` and `Frontend`.
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
  config/
  middleware/
  modules/
    auth/
      auth.routes.js
      auth.controller.js
      auth.service.js
      auth.validators.js
      registration.service.js
      registration.strategies.js
    users/
    admin/
    cases/
    documents/
    signatures/
    registrar/
    payments/
    messages/
    notifications/
  services/
  utils/
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
```

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
- Keep schema changes in `Backend/src/models/schema.sql` until migrations are introduced.
- `schema.sql` is a clean drop-and-recreate script: running it wipes every row. Use it only for local dev and fresh Supabase setup. For incremental changes once users exist, write a migration.
- When migrations are introduced, use ordered migration files and never edit historical migrations casually.
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

## Git Rules

- Work on feature branches.
- Do not commit `node_modules`.
- Commit `package-lock.json` when dependencies change.
- Do not commit `.env`.
- Do not revert unrelated teammate or user changes.
