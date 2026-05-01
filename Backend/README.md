# LawFlow Backend

Express.js backend for LawFlow authentication, authorization, sessions, and role-based access control.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to your local PostgreSQL `lawflow_db` connection string.
3. Install dependencies:

```bash
npm install
```

4. Start development server:

```bash
npm run dev
```

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
