# LawFlow Backend

Express.js backend for LawFlow authentication, authorization, sessions, and role-based access control.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to your local PostgreSQL `lawflow_db` connection string.
3. Set the Supabase storage values (see "Supabase storage" below).
4. Install dependencies:

```bash
npm install
```

5. Start development server:

```bash
npm run dev
```

## Supabase storage (lawyer verification documents)

Lawyer registration uploads three private documents (degree PDF + two license-card images) to a Supabase Storage bucket. The backend uploads server-side using the service-role key — the key MUST NOT be exposed to the frontend.

### One-time Supabase setup

1. Open the Supabase project dashboard (this project: `https://supabase.com/dashboard/project/ibubxuobppfvdgzxudig`).
2. **Storage → New bucket**:
   - Name: `lawyer-verification-documents`
   - Public bucket: **off** (private).
3. **Project Settings → API**:
   - Copy `Project URL` (e.g. `https://ibubxuobppfvdgzxudig.supabase.co`) → `SUPABASE_URL`.
   - Copy `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY`. Keep it out of git.

### `.env`

```env
SUPABASE_URL=https://ibubxuobppfvdgzxudig.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...   # service_role secret, NOT anon key
SUPABASE_LAWYER_BUCKET=lawyer-verification-documents
SUPABASE_PREVIEW_URL_EXPIRES_IN=900
```

When Supabase is not configured the backend will reject lawyer registration with HTTP 503 ("Document storage is not configured"). The admin verifications page falls back to metadata-only tiles with a "Preview unavailable — storage not configured" notice for existing rows.

### Storage layout

- Files are uploaded to `lawyer-verification-documents/lawyers/pending/<random-uuid>/<documentType>.<ext>`.
- The Postgres `lawyer_verification_documents` table only stores the bucket and storage path. Public URLs are never written.
- Admin previews use short-lived (15 minute default) signed URLs generated server-side.

## Auth API Scope

- `POST /api/auth/register/client`
- `POST /api/auth/register/lawyer`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification-otp`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Email Verification

Registration creates a 6-digit OTP and stores only its hash in PostgreSQL.

For development, if SMTP values are empty, the OTP is printed in the backend terminal as `[DEV EMAIL]`.

For real email delivery, add SMTP values to `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_google_app_password
EMAIL_FROM=LawFlow <your_email@gmail.com>
EMAIL_LOGO_URL=https://your-domain.com/lawflow-logo.png
EMAIL_OTP_EXPIRES_MINUTES=1
EMAIL_DEBUG=false
```

`EMAIL_LOGO_URL` is optional. If it is empty, the email uses the LawFlow text logo fallback. For Gmail, `EMAIL_PASS` must be a Google App Password, not your normal Gmail password.

## Login

Login requires a verified email.

```http
POST /api/auth/login
```

```json
{
  "email": "client@example.com",
  "password": "Password@123"
}
```

Successful login returns an access token and sets the refresh token as an httpOnly cookie.

Refresh uses the httpOnly `refreshToken` cookie:

```http
POST /api/auth/refresh
```

Logout revokes the active refresh session and clears the cookie:

```http
POST /api/auth/logout
```

## Lawyer document storage layout

Lawyer verification documents are stored privately in Supabase Storage under a
per-lawyer hierarchy so the bucket scales cleanly as more lawyers register:

```
lawyers/{lawyerKey}/license/degree.pdf
lawyers/{lawyerKey}/license/card-front.jpg
lawyers/{lawyerKey}/license/card-back.jpg
```

`{lawyerKey}` is a UUID generated per registration (not the `lawyer_profile.id`,
since uploads happen before the profile is created). The full path is stored
in `lawyer_verification_documents.storage_path`, so cleanup never has to guess
the location.

The `license/` subfolder is the only category in use today. New categories can
be added later (for example `cnic/` for CNIC scans, `profile/` for profile
photos) by extending the `documentLayout` map in
`src/services/storage.service.js` — no callers need to change.

## Lawyer verification flow

- **Approve**: keeps the user, flips `lawyer_profiles.verification_status` to
  `approved`, marks `users.account_status = 'active'`, and queues the approval
  email.
- **Reject**: writes a row into `lawyer_rejection_history` (preserving the
  lawyer's name, email, license, rejection reason, and the storage paths that
  will be removed), then deletes the user row. FK cascades remove
  `lawyer_profiles`, `lawyer_verification_documents`, `auth_sessions`,
  `auth_identities`, `email_verification_otps`, and `password_reset_tokens`.
  The lawyer's files in Supabase Storage are removed in a best-effort sweep
  after the transaction commits, and the rejection email is queued with the
  admin-supplied reason.

Because rejection drops the lawyer's user row, the same email / CNIC / bar
licence number is immediately re-usable for a fresh registration — no
database conflict, no special re-application endpoint needed.

### Applying the audit table on an existing database

Run once against the LawFlow Postgres DB:

```bash
psql -U postgres -d lawflow_db \
  -f src/models/2026-05-11_rejection_history_and_cleanup.sql
```

The migration creates `lawyer_rejection_history`, migrates any pre-existing
`verification_status = 'rejected'` rows into it, and deletes those legacy
user rows so their emails are free to register again.

## SJP (Sindh Judicial Portal) — optional cross-check

SJP is an **optional external directory**, not a verification gate. The admin
review flow does not require an SJP check anywhere: the approval gate is
the two manual Bar Council License checkboxes only. The Admin Verifications
page surfaces SJP as a single "Open SJP Directory" button at the bottom of
the list for admins who want to cross-reference a profile.

## Supabase Auth ↔ LawFlow Postgres sync (Google-signed-up clients)

`auth.users` in Supabase Auth lives in a different database from the LawFlow
Postgres tables, so a SQL `FOREIGN KEY ... ON DELETE CASCADE` cannot span the
two. Deleting a Google-signed-up client from the Supabase dashboard therefore
does not, by itself, remove the matching LawFlow row.

There are two complementary cleanup paths; use either or both:

### 1. Real-time webhook (recommended for prod)

The backend already exposes `POST /api/auth/webhooks/supabase` (see
`auth.controller.supabaseAuthWebhook`). It verifies an `x-webhook-secret`
header with a timing-safe compare and, on `DELETE` events for `auth.users`,
deletes the matching LawFlow user. Existing FK cascades handle every
dependent row (`client_profiles`, `auth_sessions`, `auth_identities`,
`email_verification_otps`, `password_reset_tokens`, plus the lawyer-side
tables for completeness).

To wire it up:

1. Set `SUPABASE_WEBHOOK_SECRET` in `Backend/.env`.
2. Make the backend reachable from Supabase (a real deployment URL, or
   `ngrok http 5000` for local dev).
3. Run `src/models/supabase_auth_users_delete_webhook.sql` in the
   Supabase SQL Editor, replacing `LAWFLOW_PUBLIC_URL` and
   `SUPABASE_WEBHOOK_SECRET` with your values. The migration uses `pg_net`
   to register a trigger on `auth.users` DELETE that POSTs to the webhook.

### 2. Reconciliation script (safety net / dev workflow)

If you cannot expose the backend publicly, or want a periodic sweep, run:

```bash
# dry-run — prints orphan users without changing anything
cd Backend && npm run sync:supabase-users

# actually delete
cd Backend && npm run sync:supabase-users:apply
```

The script lists every Supabase `auth.users` row and every LawFlow user with
`auth_provider = 'google'`, then deletes any LawFlow row whose Supabase
identity is gone. Internal FK cascades clean up the rest.
