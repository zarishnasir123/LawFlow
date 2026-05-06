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
