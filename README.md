<div align="center">

# ⚖️ LawFlow

### A digital case-management platform for Pakistan's civil & family courts

*Prepare the case. Sign it. Submit it to the court. Track it — all online.*
*The hearing still happens in front of a real judge.*

</div>

---

## Table of Contents

1. [What LawFlow Is](#1-what-lawflow-is)
2. [What It Is **Not** (Scope)](#2-what-it-is-not-scope)
3. [The Four Roles](#3-the-four-roles)
4. [The Business Flow — End to End](#4-the-business-flow--end-to-end)
5. [Feature Catalogue (by role)](#5-feature-catalogue-by-role)
6. [System Architecture](#6-system-architecture)
7. [Technology Stack](#7-technology-stack)
8. [The Money Flow (Marketplace Payments)](#8-the-money-flow-marketplace-payments)
9. [Data Model](#9-data-model)
10. [Repository Layout](#10-repository-layout)
11. [Getting Started](#11-getting-started)
12. [Environment Configuration](#12-environment-configuration)
13. [Security Model](#13-security-model)

---

## 1. What LawFlow Is

LawFlow is a **web platform that digitizes how a court case is prepared, signed, submitted, and tracked** in Pakistan — focused on **civil and family matters**.

Today, getting a case into court is a paper-heavy, in-person process: a lawyer drafts the petition by hand, gets the client to sign physical copies, walks the file to the court's registrar office, and then everyone keeps phoning to find out the next hearing date. LawFlow takes that whole "before the courtroom" journey online.

In one sentence:

> **A lawyer builds the complete case file inside LawFlow, the client e-signs it, the lawyer submits it to the right court registrar, and from then on the client and lawyer track the case and its hearing dates from their dashboards — while still attending the actual hearings in person.**

It is built as a small **marketplace**: clients find and hire verified lawyers, pay them securely through the platform, and LawFlow keeps a commission on each payment.

---

## 2. What It Is *Not* (Scope)

This boundary is deliberate and important to understand the whole design:

- ❌ **It does not file cases into the court's own computer system.** There is no live integration with the judiciary's backend.
- ❌ **It does not hold hearings online.** Hearings happen **physically**, in front of a **real judge**, in a real courtroom.
- ❌ **There is no "judge" role** in the software.

Instead, the **court registrar** is the human bridge between LawFlow and the physical court:

```
  Lawyer (in LawFlow)  ──submit case──►  Registrar (sits in the court)
                                              │
                                              ├─ reviews the file
                                              ├─ accepts it  /  returns it with remarks
                                              └─ records the hearing dates the judge assigns
                                                          │
  Client & Lawyer  ◄──see status & dates──────────────────┘   (attend hearing in person)
```

So LawFlow digitizes **case preparation, submission, and tracking** — not online litigation.

---

## 3. The Four Roles

| Role | Who they are | What they do in LawFlow |
|------|--------------|--------------------------|
| 👤 **Client** | A citizen who needs legal help | Finds a verified lawyer, chats with them, e-signs the case documents, pays securely, and tracks the case + hearing dates. |
| 🧑‍⚖️ **Lawyer** | A practising advocate | Builds the case file from legal templates, drafts documents, uses an AI assistant, e-signs with the client, submits to the registrar, manages fees, and gets paid. |
| 🏛️ **Registrar** | A court registry officer (the court-side bridge) | Reviews submitted case files, accepts or returns them with remarks, and schedules/records hearing dates into courtrooms. |
| 🛡️ **Admin** | The LawFlow platform operator | Verifies lawyers, creates registrar accounts, manages document templates, oversees all money, and sets the commission rate. |

**How each role gets an account:**
- **Clients & lawyers** sign themselves up (clients can also use *Sign in with Google*).
- **Lawyers** must additionally upload their Bar Council licence documents and wait for **admin verification** before they appear in the directory.
- **Registrars** never self-register — an **admin creates** their account and the system emails them a temporary password they must change on first login.
- **Admin** is a permanent, seeded account.

---

## 4. The Business Flow — End to End

This is the complete journey a real case takes through the system.

### Step 1 — Onboarding & verification
A client registers (email + OTP, or Google). A lawyer registers and uploads their **degree + licence card** documents. An **admin reviews** the lawyer against their Bar Council licence and **approves, rejects, or suspends** them. Only approved lawyers become visible to clients.

### Step 2 — Find & engage a lawyer
The client browses the **"Find a Lawyer"** directory of verified lawyers, opens a profile, and starts a **chat**. The chat is WhatsApp-style — real-time messages, document sharing, and voice notes (no audio/video calls).

### Step 3 — Build the case file
The lawyer creates a case and picks:
- one of **10 supported case types** (5 civil + 5 family — see below), and
- the **tehsil** (court jurisdiction) the case belongs to.

LawFlow loads the matching **Word (.docx) template** into an in-browser **document editor**. The lawyer fills in the petition while the template's exact court formatting (fonts, margins, page layout) is preserved. Evidence files can be attached. Throughout, the lawyer can ask the **AI Legal Assistant** for guidance grounded in Pakistani civil/family law.

> **The 10 case types**
> **Civil:** Recovery of Money · Permanent Injunction · Declaration · Specific Performance of Agreement · Possession of Property
> **Family:** Khula · Maintenance (Wife & Children) · Recovery of Dowry Articles · Custody of Minors (Hizanat) · Restitution of Conjugal Rights

### Step 4 — E-signature
When the document is ready, **both the client and the lawyer e-sign** it. LawFlow places each signature exactly where it belongs on the page and compiles a single **signed PDF** of the final case file.

### Step 5 — Submit to the registrar
The lawyer **submits** the signed case file to the registrar of the chosen tehsil. (Submission requires a tehsil and a signed PDF.)

### Step 6 — Registrar review
The registrar sees the case in their queue and either:
- ✅ **Accepts** it (the case is now lodged with the court), or
- ↩️ **Returns** it **with remarks** — the lawyer fixes the issues and **resubmits**.

### Step 7 — Hearings
For accepted cases, the registrar **schedules hearing dates** into available courtrooms (the system proposes the next free, non-holiday slot, which the registrar confirms; hearings can be rescheduled or cancelled, and outcomes recorded). The **client and lawyer see the hearing dates** on their dashboards — and **attend the hearing in person**.

### Step 8 — Payment
The lawyer sets the **fee / payment plan** (one total, optionally split into installments with due dates). The client pays securely online via **Safepay**. LawFlow collects the money, **keeps a commission (default 10%)**, and credits the lawyer's share. Overdue installments trigger automatic reminders to both parties.

### Step 9 — Payout
The lawyer sees their **net earnings and available balance**, then **requests a payout**. The admin reviews payout requests in their dashboard and **disburses** the money (recording transfer proof), after which the lawyer is notified and the balance settles.

### Step 10 — Track & stay informed
At every step, the client and lawyer get **in-app notifications and emails** (which they can fine-tune in preferences), and can follow the case's full **status timeline / audit trail**.

---

## 5. Feature Catalogue (by role)

<details open>
<summary><b>👤 Client</b></summary>

- Self-registration with email OTP **or Google sign-in**
- Find-a-Lawyer directory + lawyer profile view
- Real-time chat with the lawyer (documents + voice notes)
- E-sign case documents; view the signed file
- Pay fees / installments via Safepay; download invoice-style receipts
- Track case status and **hearing dates**
- Dashboard with active cases, upcoming hearings, pending signatures, unread messages
- Notifications (bell + email) with per-category preferences
- Profile & account management (incl. self-deactivation with a 30-day recovery window)
</details>

<details>
<summary><b>🧑‍⚖️ Lawyer</b></summary>

- Self-registration with **licence-document upload** → admin verification
- Public profile in the lawyer directory
- Create / edit / delete cases (draft → submit lifecycle)
- **Document editor** built on the actual court `.docx` template (high-fidelity)
- Evidence/image attachments
- **AI Legal Assistant** — grounded, scope-locked to the 10 case types, with saved chat history
- Full **e-signature** flow with the client → compiled signed PDF
- Submit to registrar; fix-and-resubmit returned cases
- Set **service charges** and **payment plans** (editable installment due dates)
- Earnings breakdown, available balance, **request payout**
- Real-time chat with clients
- Dashboard, notifications (bell + email preferences)
</details>

<details>
<summary><b>🏛️ Registrar</b></summary>

- Admin-provisioned account (temp password → forced change on first login)
- **Case review queue** scoped to the registrar's assigned tehsil
- View a submitted case + its signed PDF
- **Accept** a case or **Return with remarks**
- **Hearing scheduling** — manage courtrooms, manage holidays, propose/confirm/reschedule/cancel hearings, record outcomes
- Dashboard with approved/returned counts
- Profile management
</details>

<details>
<summary><b>🛡️ Admin (separate panel)</b></summary>

- **Lawyer verification** — approve / reject / suspend / reinstate, with rejection history
- **Registrar account management** (create, edit, resend credentials)
- **Case-type template management** — upload/replace/remove the `.docx` per case type, with preview
- **Case tracking** — full audit timeline per case + payment-readiness
- **Finances dashboard** — total collected, platform fees, paid out, amount owed, per-lawyer breakdown, reconciliation
- **Payouts** — review requests and disburse with transfer proof
- **Commission rate** setting
- Dashboard stats, notifications, profile & password management
</details>

---

## 6. System Architecture

LawFlow is a small **monorepo** with **three deployable apps** sharing **one backend API + database**.

```
                         ┌──────────────────────────────┐
                         │        PostgreSQL (Supabase)  │
                         │   + Supabase Storage (files)  │
                         └──────────────┬───────────────┘
                                        │
                         ┌──────────────┴───────────────┐
                         │     Backend  (Node/Express)   │
                         │  REST API  +  WebSocket chat   │
                         │  Auth · Cases · Signatures ·   │
                         │  Payments · Hearings · AI ·    │
                         │  Notifications · Chat          │
                         └───┬───────────────────────┬───┘
                             │                       │
              ┌──────────────┴───────┐      ┌────────┴───────────┐
              │  Frontend  (:5173)   │      │ Frontend-Admin     │
              │  React SPA           │      │  (:5174) React SPA │
              │  Client · Lawyer ·   │      │  Admin only        │
              │  Registrar           │      │                    │
              └──────────────────────┘      └────────────────────┘
```

**Why two frontends?** The admin panel is kept as a **separate app** so a compromise of the public app can't reach admin session state, and the admin bundle stays small. Admins log in *only* at `:5174`; the main app never accepts admin credentials.

**Backend layering** (enforced across every feature module):

```
routes  →  validators  →  controller  →  service  →  database
(endpoints) (input check) (HTTP only)  (business logic + SQL)
```

External integrations (email, storage, payments, AI) live in `services/` and are reused across modules.

---

## 7. Technology Stack

### Backend (`Backend/`)
| Concern | Technology |
|---------|-----------|
| Runtime / framework | **Node.js + Express** (ES modules) |
| Database | **PostgreSQL** (hosted on **Supabase**), `pg` with parameterized queries |
| File storage | **Supabase Storage** (private buckets: licence docs, chat attachments, payout receipts, case templates) |
| Auth | **JWT** access tokens + httpOnly refresh cookies, **bcrypt** hashing, **Google OAuth** (clients only, via Supabase) |
| Real-time | **WebSocket** (`ws`) for live chat, typing, presence, read receipts |
| Payments | **Safepay** (Pakistan) checkout + server-to-server verification |
| Documents | `.docx` templates rendered with **docx-preview**; signed files compiled with **pdf-lib** |
| AI | **Groq** (default, Llama 3.3) with **Google Gemini** fallback — grounded legal guidance |
| Email | **Nodemailer** + **Handlebars** templates |
| Security | helmet, hpp, CORS allow-list, express-validator, RBAC middleware, rate limiting |

### Frontend & Admin (`Frontend/`, `Frontend-Admin/`)
| Concern | Technology |
|---------|-----------|
| Framework | **React 19 + TypeScript** on **Vite** |
| Routing | **TanStack Router** (code-based) |
| Server state | **TanStack Query** |
| Local state | **Zustand** (sparingly) |
| Forms | **React Hook Form** |
| HTTP | **Axios** (one shared client with a refresh interceptor) |
| Styling | **Tailwind CSS v4** (brand colour `#01411C`) |
| Icons | **lucide-react** |
| Documents | **docx-preview** (editor), **react-pdf** / **pdf-lib** (viewing/signing), **react-rnd** (signature placement) |
| Charts | chart.js (main app) · recharts (admin) |

---

## 8. The Money Flow (Marketplace Payments)

LawFlow runs as a real marketplace: **the platform collects the money, takes a commission, and pays the lawyer.**

```
  Client pays ──► Safepay collects ──► LawFlow records the payment
                                              │
                              auto-split per transaction
                              ┌───────────────┴───────────────┐
                       Platform fee (10%, configurable)   Lawyer net (90%)
                                                              │
                                                Lawyer requests payout
                                                              │
                                          Admin reviews & disburses (with proof)
                                                              │
                                          Lawyer notified · balance settles
```

- **Collection is real** via Safepay (sandbox), verified server-to-server so a client can't fake a payment.
- The **10% commission** is snapshotted on every transaction, so changing the rate only affects future payments.
- **Disbursement** runs through a provider-agnostic adapter on a **sandbox-simulated rail** — real bank payouts in Pakistan require an SBP-licensed rail (RAAST/1Link), which is the documented production step.
- The **admin Finances dashboard** always reconciles: `Collected = Platform fees + Paid out + Owed`.

---

## 9. Data Model

The schema (`Backend/src/models/schema.sql`) is normalized to ~3NF, with login identity in `users` and role data in profile tables. Major groups:

| Domain | Key tables |
|--------|-----------|
| **Identity & auth** | `roles`, `users`, `client_profiles`, `lawyer_profiles`, `registrar_profiles`, `auth_sessions`, `auth_identities`, `email_verification_otps`, `password_reset_tokens`, `pending_registrations` |
| **Lawyer verification** | `lawyer_verification_documents`, `lawyer_rejection_history` |
| **Cases & documents** | `case_types`, `case_type_templates`, `cases`, `case_attachments`, `case_events` (audit trail), `signature_requests` |
| **Hearings** | `courtrooms`, `holidays`, `hearings`, `hearing_outcomes` |
| **Payments** | `lawyer_service_charges`, `agreements`, `payment_plans`, `installments`, `payment_transactions`, `payment_receipts`, `platform_settings`, `payouts` |
| **Communication** | `chat_conversations`, `chat_messages`, `chat_reads`, `notifications`, `notification_preferences` |
| **AI assistant** | `ai_chat_sessions`, `ai_chat_messages` |

> Row-Level Security is enabled on every table; the backend uses the Supabase **service-role key** and is the single trusted writer. The frontends never talk to the database directly.

---

## 10. Repository Layout

```
LawFlow/
├── Backend/                     Node/Express API + WebSocket server
│   └── src/
│       ├── config/              app, db, supabase config
│       ├── middleware/          auth, RBAC, validation, errors
│       ├── modules/             feature modules (routes/controller/service/validators)
│       │   ├── auth/            registration, login, OTP, OAuth, password reset
│       │   ├── cases/           case CRUD, submission, templates, audit events
│       │   ├── signatures/      per-signer requests + signed-PDF compiler
│       │   ├── registrarReview/ registrar case-review queue (accept/return)
│       │   ├── hearings/        courtrooms, holidays, scheduling
│       │   ├── payments/        service charges, agreements, Safepay, payouts
│       │   ├── chat/            one-to-one messaging
│       │   ├── ai/              lawyer AI legal assistant
│       │   ├── notifications/   in-app notifications + email preferences
│       │   ├── admin/           verification, money dashboard, templates, case tracking
│       │   ├── lawyers/ clients/ registrar/ users/
│       ├── realtime/            WebSocket chat server
│       ├── services/            email, storage, AI (groq/gemini), disbursement
│       ├── models/schema.sql    full database schema (drop-and-recreate)
│       └── server.js            entry point
│
├── Frontend/                    React SPA — Client, Lawyer, Registrar (:5173)
│   └── src/
│       ├── app/                 router, route guards, app shell
│       ├── modules/             auth, client, lawyer, registrar, payments, marketing
│       └── shared/              axios client, shared components/hooks/utils
│
├── Frontend-Admin/              React SPA — Admin only (:5174)
│   └── src/modules/admin/       dashboard, verifications, registrars, payouts, finances, templates
│
├── AGENTS.md                    cross-cutting engineering rules
├── Frontend-AGENTS.md           main-app rules
├── Frontend-Admin-AGENTS.md     admin-app rules
└── package.json                 monorepo scripts (runs all three apps)
```

---

## 11. Getting Started

### Prerequisites
- **Node.js 18+** (the backend targets Node 22)
- **PostgreSQL** (local) or a **Supabase** project
- A **Supabase** project for file storage
- (Optional for full functionality) Safepay sandbox keys, an SMTP account, and a Groq or Gemini API key

### 1. Install everything (from the repo root)
```bash
npm run install:all
```
This installs dependencies for `Backend`, `Frontend`, and `Frontend-Admin`.

### 2. Create the database
Create a `lawflow_db` PostgreSQL database, then load the schema:
```bash
psql -U postgres -d lawflow_db -f Backend/src/models/schema.sql
```
> ⚠️ `schema.sql` is a **drop-and-recreate** script — it wipes all data. Use it only for first-time setup / local dev.

### 3. Configure environment
Copy each `.env.example` to `.env` and fill in the values (see [Environment Configuration](#12-environment-configuration)):
```bash
cp Backend/.env.example        Backend/.env
cp Frontend/.env.example       Frontend/.env
cp Frontend-Admin/.env.example Frontend-Admin/.env
```

### 4. Run all three apps together (from the repo root)
```bash
npm run dev
```
This starts:
- **Backend** API → `http://localhost:5000`
- **Frontend** (client/lawyer/registrar) → `http://localhost:5173`
- **Frontend-Admin** → `http://localhost:5174`

You can also run any app on its own (`npm run dev:be`, `dev:fe`, `dev:admin`).

### Default admin login
The schema seeds an admin account — sign in at **`:5174`** with the credentials defined in `schema.sql` and change the password.

---

## 12. Environment Configuration

The backend `.env` is the most involved. Key groups (full list in `Backend/.env.example`):

| Group | Variables |
|-------|-----------|
| **Core** | `PORT`, `NODE_ENV`, `FRONTEND_URL`, `ADMIN_URL`, `FRONTEND_URLS` |
| **Database** | `DATABASE_URL` |
| **Jurisdiction** | `SUPPORTED_TEHSILS` *(must list every tehsil offered in case-create / registrar dropdowns)*, `ALLOWED_CNIC_PREFIXES` |
| **Auth / cookies** | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, token TTLs, `COOKIE_SAME_SITE`, `COOKIE_SECURE` |
| **Supabase storage** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, bucket names (lawyer / chat / payout-receipt / case-template), `SUPABASE_WEBHOOK_SECRET` |
| **Email (SMTP)** | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, … |
| **Payments** | `SAFEPAY_API_KEY`, `SAFEPAY_SECRET_KEY`, `SAFEPAY_ENVIRONMENT`, `SAFEPAY_CURRENCY`, `PAYOUT_DISBURSEMENT_MODE`, `PUBLIC_API_URL` |
| **AI** | `AI_PROVIDER` (`groq` \| `gemini`), `GROQ_API_KEY` / `GROQ_MODEL`, `GEMINI_API_KEY` / `GEMINI_MODEL` |

The frontends only need `VITE_API_URL` (defaults to `http://localhost:5000/api` in dev).

> **Graceful degradation:** if SMTP isn't set, OTPs/emails print to the backend console as `[DEV EMAIL]`. If Supabase or AI keys aren't set, those specific features return a clean `503` instead of crashing — the rest of the app keeps working.

---

## 13. Security Model

LawFlow handles private legal data, so security is a first-class concern:

- **Role-based access control** enforced on the **backend** (`authenticate` + `authorizeRoles`) — the frontend role is only a UI hint.
- **Ownership checks** on every private resource (a user can only read/modify their own cases, chats, payments, notifications).
- **No secrets in the browser** — access tokens live in memory, refresh tokens in **httpOnly cookies**; the Supabase service-role key and JWT secrets stay backend-only.
- **Parameterized SQL** everywhere; **RLS** enabled on every table.
- **Private file storage** — documents, signatures, and receipts are served via short-lived **signed URLs**, never public links.
- **Sensitive values are never logged** (passwords, tokens, OAuth codes, CNICs, emails, document URLs, signatures).
- **OAuth login-CSRF** defended with a state cookie; Google identities matched by stable provider id, never by email.

Full engineering and security rules live in **`AGENTS.md`**, **`Frontend-AGENTS.md`**, and **`Frontend-Admin-AGENTS.md`**.

---

<div align="center">

*LawFlow — bringing Pakistan's case preparation, submission, and tracking online,*
*while the courtroom stays where it belongs.*

</div>
