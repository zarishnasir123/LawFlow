-- LawFlow database schema
-- Single-shot script: drops every LawFlow table and recreates from scratch.
-- WARNING: this wipes all rows. Use only on local dev / fresh setup.
--
-- Apply with:
--   psql -U postgres -h localhost -d lawflow_db -f Backend/src/models/schema.sql

-- =====================================================================
-- Extensions
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =====================================================================
-- Drop in reverse dependency order. CASCADE removes dependent objects.
-- =====================================================================
DROP TABLE IF EXISTS hearing_outcomes               CASCADE;
DROP TABLE IF EXISTS hearings                       CASCADE;
DROP TABLE IF EXISTS holidays                       CASCADE;
DROP TABLE IF EXISTS courtrooms                     CASCADE;
DROP TABLE IF EXISTS ai_chat_messages               CASCADE;
DROP TABLE IF EXISTS ai_chat_sessions               CASCADE;
DROP TABLE IF EXISTS user_activity                  CASCADE;
DROP TABLE IF EXISTS notification_preferences       CASCADE;
DROP TABLE IF EXISTS notifications                  CASCADE;
DROP TABLE IF EXISTS platform_settings              CASCADE;
DROP TABLE IF EXISTS payouts                         CASCADE;
DROP TABLE IF EXISTS payment_receipts               CASCADE;
DROP TABLE IF EXISTS payment_transactions           CASCADE;
DROP TABLE IF EXISTS installments                   CASCADE;
DROP TABLE IF EXISTS payment_plans                  CASCADE;
DROP TABLE IF EXISTS agreements                     CASCADE;
DROP TABLE IF EXISTS lawyer_service_charges         CASCADE;
DROP TABLE IF EXISTS case_events                    CASCADE;
DROP TABLE IF EXISTS signature_requests             CASCADE;
DROP TABLE IF EXISTS case_attachments               CASCADE;
DROP TABLE IF EXISTS cases                          CASCADE;
DROP TABLE IF EXISTS case_type_templates            CASCADE;
DROP TABLE IF EXISTS case_types                     CASCADE;
DROP TABLE IF EXISTS lawyer_rejection_history       CASCADE;
DROP TABLE IF EXISTS auth_identities                CASCADE;
DROP TABLE IF EXISTS auth_sessions                  CASCADE;
DROP TABLE IF EXISTS password_reset_tokens          CASCADE;
DROP TABLE IF EXISTS email_verification_otps        CASCADE;
DROP TABLE IF EXISTS lawyer_verification_documents  CASCADE;
DROP TABLE IF EXISTS lawyer_profiles                CASCADE;
DROP TABLE IF EXISTS registrar_profiles             CASCADE;
DROP TABLE IF EXISTS client_profiles                CASCADE;
DROP TABLE IF EXISTS pending_registrations          CASCADE;
DROP TABLE IF EXISTS users                          CASCADE;
DROP TABLE IF EXISTS roles                          CASCADE;

-- Legacy Supabase-side trigger function. Safe no-op if it never existed.
DROP FUNCTION IF EXISTS public.handle_new_user();

-- =====================================================================
-- Reference data
-- =====================================================================
CREATE TABLE roles (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES
  ('client'),
  ('lawyer'),
  ('registrar'),
  ('admin');

-- =====================================================================
-- Identity
-- =====================================================================
CREATE TABLE users (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),

  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100) NOT NULL,
  email      CITEXT UNIQUE NOT NULL,

  -- Optional fields. Google OAuth users have no CNIC and no local password,
  -- and may opt out of phone. Manual registrants must supply CNIC + phone
  -- via the app-level validators (registerClientValidator / registerLawyerValidator).
  phone         VARCHAR(20),
  cnic          VARCHAR(15) UNIQUE,
  password_hash TEXT,

  auth_provider VARCHAR(30) NOT NULL DEFAULT 'local',

  email_verified        BOOLEAN     NOT NULL DEFAULT false,
  account_status        VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
  -- Set true when the password was provisioned by someone other than the user
  -- (e.g. admin-created registrar accounts where the temporary password was
  -- emailed). Login still works but the user must rotate the password via
  -- /api/auth/change-password before any other authenticated request will
  -- be honoured by the frontend.
  must_change_password  BOOLEAN     NOT NULL DEFAULT false,
  failed_login_attempts INTEGER     NOT NULL DEFAULT 0,
  locked_until          TIMESTAMP,

  -- Set atomically the first time the user opens any dashboard (see
  -- getCurrentUser in auth.service.js). NULL = the user has never opened
  -- the dashboard, so the UI renders "Welcome, ..." instead of
  -- "Welcome back, ...".
  first_login_at        TIMESTAMP,

  -- Path to the user's avatar in the Supabase `user-avatars` bucket
  -- (e.g., "users/{uuid}/avatar.png"). NULL when the user hasn't
  -- uploaded a picture yet — the frontend then falls back to a
  -- first-letter initial circle. Lives on `users` (not client_profiles)
  -- so lawyers and registrars can use the same field when their
  -- profile pages get this feature.
  avatar_storage_path   TEXT,

  -- Timestamp of the most recent self-service account deactivation.
  -- NULL means the account has never been self-deactivated (covers
  -- the active path and admin-imposed inactivity/suspension). When
  -- set alongside account_status='inactive', login()'s recovery
  -- window logic engages: ≤30 days → silent reactivation on next
  -- successful sign-in; >30 days → permanent delete + "account no
  -- longer exists" response so the user re-registers from scratch.
  deactivated_at        TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_cnic_format
    CHECK (cnic IS NULL OR cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$'),
  CONSTRAINT valid_account_status
    CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  CONSTRAINT valid_auth_provider
    CHECK (auth_provider IN ('local', 'google'))
);

-- Default admin for local dev.
-- Login: lawflowadmin@gmail.com / Admin@123
INSERT INTO users (
  role_id,
  first_name,
  last_name,
  email,
  phone,
  cnic,
  password_hash,
  auth_provider,
  email_verified,
  account_status
)
VALUES (
  (SELECT id FROM roles WHERE name = 'admin'),
  'LawFlow',
  'Admin',
  'lawflowadmin@gmail.com',
  '+920000000000',
  '34104-0000000-1',
  crypt('Admin@123', gen_salt('bf', 12)),
  'local',
  true,
  'active'
);

-- =====================================================================
-- Pending registrations (waiting on email OTP)
-- =====================================================================
CREATE TABLE pending_registrations (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),

  email        CITEXT       UNIQUE NOT NULL,
  cnic         VARCHAR(15)  UNIQUE NOT NULL,
  first_name   VARCHAR(100) NOT NULL,
  last_name    VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20)  NOT NULL,

  password_hash TEXT  NOT NULL,
  profile_data  JSONB NOT NULL,
  otp_hash      TEXT  NOT NULL,
  expires_at    TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_pending_registration_cnic_format
    CHECK (cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$')
);

-- =====================================================================
-- Role profiles
-- =====================================================================
CREATE TABLE client_profiles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  address TEXT,
  city    VARCHAR(100),
  tehsil  VARCHAR(100),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Registrars are admin-provisioned: no self-registration, no OTP flow.
-- Identity (name/email/phone/cnic/password_hash/account_status) stays in
-- users; court-side fields and the audit pointer to the creating admin live
-- here, mirroring client_profiles / lawyer_profiles.
CREATE TABLE registrar_profiles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  assigned_court  VARCHAR(150),
  assigned_tehsil VARCHAR(100),

  -- Tracks the most recent automatic/manual credentials email. NULL until the
  -- first send. We never store the temporary password itself — only the bcrypt
  -- hash in users.password_hash — so re-sending generates a fresh password.
  credentials_email_sent_at TIMESTAMP,

  -- Audit pointer to the admin who provisioned the account. ON DELETE SET NULL
  -- so removing an admin user does not cascade-delete their registrars.
  created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE lawyer_profiles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  specialization     VARCHAR(150) NOT NULL,
  district_bar       VARCHAR(150) NOT NULL,
  bar_license_number VARCHAR(100) UNIQUE NOT NULL,
  experience_years   INTEGER DEFAULT 0,
  -- Free-text "About" section the lawyer writes after registration
  -- to introduce themselves to potential clients on the public
  -- directory. Optional: registration never collects it (keeps the
  -- signup form short), but the Edit Profile form does. Capped at
  -- 2000 chars by the backend validator.
  bio                TEXT,

  -- Payout/bank details: where LawFlow settles this lawyer's collected
  -- installment payments. The platform collects payments via its own Safepay
  -- account and pays each lawyer his share to this account. Optional until the
  -- lawyer fills them in on the Payments Received page. Never exposed on the
  -- public lawyer directory.
  payout_account_title  VARCHAR(150),
  payout_account_number VARCHAR(50),
  payout_bank_name      VARCHAR(150),

  cnic_match         BOOLEAN NOT NULL DEFAULT false,
  cnic_match_remarks TEXT,

  verification_status  VARCHAR(30) NOT NULL DEFAULT 'pending',
  verification_remarks TEXT,
  verified_by          UUID REFERENCES users(id),
  verified_at          TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_lawyer_verification_status
    CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'))
);

-- File metadata only; actual files live in Supabase private storage.
CREATE TABLE lawyer_verification_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,

  document_type VARCHAR(50) NOT NULL,

  storage_bucket VARCHAR(100) NOT NULL,
  storage_path   TEXT NOT NULL,

  file_name TEXT,
  mime_type VARCHAR(100),
  file_size BIGINT,

  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_lawyer_document_type
    CHECK (document_type IN (
      'law_degree',
      'bar_license_card',
      'bar_license_card_front',
      'bar_license_card_back'
    )),

  CONSTRAINT unique_lawyer_document_type
    UNIQUE (lawyer_profile_id, document_type)
);

-- =====================================================================
-- Auth supporting tables
-- =====================================================================
CREATE TABLE email_verification_otps (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Hash only. Never store or log plaintext OTPs.
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- SHA-256 hex of the random 256-bit reset token. UNIQUE so the redemption
  -- endpoint is an O(1) indexed lookup instead of a per-row hash compare.
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Refresh tokens are SHA-256-hashed before storage so leaked DB rows cannot
  -- be replayed. SHA-256 (not bcrypt) is the correct choice here: refresh
  -- tokens are 256-bit signed JWTs, so preimage resistance is what matters,
  -- not the brute-force cost a slow KDF buys you against low-entropy
  -- passwords. UNIQUE gives an O(1) indexed lookup at logout/refresh time —
  -- bcrypt previously forced a linear scan + compare per active session.
  refresh_token_hash TEXT NOT NULL UNIQUE,
  user_agent         TEXT,
  ip_address         VARCHAR(100),
  is_revoked         BOOLEAN NOT NULL DEFAULT false,
  revoked_at         TIMESTAMP,
  expires_at         TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OAuth identity links. One row per (provider, provider_user_id) pair.
-- Joining on email is unsafe because email ownership can change over time;
-- this table lets us reuse the same LawFlow user across repeat Google sign-ins
-- without ever silently merging into an existing local-password account.
CREATE TABLE auth_identities (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  provider         VARCHAR(30) NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email   CITEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (provider, provider_user_id)
);

-- Audit trail of rejected lawyer applications. We persist this BEFORE
-- deleting the lawyer's user row on rejection so:
--   1) storage stays clean (no orphan files / DB rows for ever-rejected lawyers),
--   2) the email can be re-used for a fresh re-registration without conflict,
--   3) admins can still audit who was rejected, when, why, and by whom.
-- Note: no FK to users(id) on purpose — the user is intentionally deleted.
CREATE TABLE lawyer_rejection_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email              CITEXT       NOT NULL,
  cnic               VARCHAR(15),
  bar_license_number VARCHAR(100),
  first_name         VARCHAR(100),
  last_name          VARCHAR(100),
  phone              VARCHAR(20),
  specialization     VARCHAR(150),
  district_bar       VARCHAR(150),

  rejection_remarks    TEXT,
  rejected_by_user_id  UUID,
  rejected_by_email    CITEXT,
  rejected_at          TIMESTAMP NOT NULL DEFAULT NOW(),

  storage_paths_cleared TEXT[]
);

-- =====================================================================
-- Module 3: Case file drafting (Online Document Editing & PDF Preparation)
-- =====================================================================

-- Catalog of supported plaint/petition types. One row per template the lawyer
-- can pick from when creating a new case. category constrained to the two
-- tracks LawFlow supports at the tehsil level; a new category is a schema
-- change rather than a runtime config.
CREATE TABLE case_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category      VARCHAR(20) NOT NULL CHECK (category IN ('civil', 'family')),
  code          VARCHAR(80) NOT NULL UNIQUE,
  display_name  VARCHAR(200) NOT NULL,
  governing_law VARCHAR(300),
  sort_order    INT NOT NULL DEFAULT 0,

  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Admin-uploaded Word template for a case type. One row per case type (the
-- UNIQUE on case_type_id enforces "one complete document per type"; a replace
-- is an upsert, not a second row). When a row exists here, the lawyer editor
-- serves THIS file; when it doesn't, the editor falls back to the built-in
-- .docx shipped on disk under services/case-templates/. The actual bytes live
-- in the private Supabase bucket recorded in storage_bucket/storage_path, so
-- this table only ever holds metadata + the pointer.
CREATE TABLE case_type_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  case_type_id        UUID NOT NULL UNIQUE REFERENCES case_types(id) ON DELETE CASCADE,

  storage_bucket      VARCHAR(120),
  storage_path        VARCHAR(400) NOT NULL,
  file_name           VARCHAR(300),
  mime_type           VARCHAR(150),
  file_size           BIGINT,

  -- Who uploaded it (an admin). SET NULL on user delete so an audit pointer
  -- never blocks removing an admin account; the template itself survives.
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- A case is owned by exactly one lawyer (lawyer_user_id) and references one
-- case_types row for its drafting template. client_* columns are free-form
-- for now — Module 5 will introduce a nullable client_user_id linking to a
-- registered LawFlow user and treat these as the fallback.
CREATE TABLE cases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_type_id    UUID NOT NULL REFERENCES case_types(id),

  title           VARCHAR(300) NOT NULL,
  description     TEXT,

  client_name     VARCHAR(200) NOT NULL,
  client_email    VARCHAR(200),
  client_phone    VARCHAR(30),
  client_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,

  opposite_party_name VARCHAR(200) NOT NULL,

  -- The lawyer's edited HTML state of the case document. NULL until the
  -- lawyer makes a change — when NULL, the editor renders the freshly
  -- fetched template bytes from case-templates/<category>/<code>.docx.
  -- Inline images (CNICs, photos) live here as data: URLs inside the
  -- HTML, so a single column captures the entire edit state.
  edited_html     TEXT,

  -- Final compiled signed PDF metadata. The compiler embeds each
  -- signer's client-rendered page PNGs (signature_requests.signed_page_images)
  -- into a single PDF via pdf-lib. No server-side HTML rendering, so
  -- the artifact is byte-identical to what the signer reviewed in the
  -- browser. The PDF itself lives in Supabase Storage (private bucket
  -- `case-signed-pdfs`); we only store the object key + a generation
  -- timestamp here. Path is never returned to the client — lawyer
  -- downloads via a short-lived signed URL minted on demand.
  signed_pdf_storage_path  TEXT,
  signed_pdf_generated_at  TIMESTAMP,

  -- Jurisdiction the lawyer picks at case creation. Routes the case to the
  -- registrar whose registrar_profiles.assigned_tehsil matches (case-insensitive
  -- equality). Must be populated before the case can be submitted for review.
  assigned_tehsil VARCHAR(100),

  -- Registrar review trail. review_remarks holds the registrar's reason when a
  -- case is bounced back (status='returned'); reviewed_at / reviewed_by_registrar_id
  -- stamp who actioned the most recent approve/return. reviewed_by_registrar_id
  -- nulls out if the registrar account is later deleted.
  review_remarks  TEXT,
  reviewed_at     TIMESTAMP,
  reviewed_by_registrar_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- draft = lawyer is still drafting / editing
  -- submitted = sent to registrar, awaiting review
  -- returned = registrar bounced it back with remarks
  -- accepted = registrar approved it for filing
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'returned', 'accepted', 'disposed')),
  needs_manual_scheduling BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMP
);

-- =====================================================================
-- Case attachments: lawyer-uploaded image evidence / supporting files
-- that get drag-dropped into the docx editor as floating overlays
-- (Word's "In Front of Text" layout). The actual bytes live in
-- Supabase Storage under cases/{caseId}/{attachmentId}/{filename};
-- this row holds the metadata + the storage path so we can re-mint
-- a signed URL on every case re-open.
--
-- The editor's saved HTML (cases.edited_html) contains <img> tags
-- pointing at signed URLs that EXPIRE — when the lawyer reopens the
-- case the frontend fetches the attachment list, mints fresh signed
-- URLs, and rewrites the restored DOM. That's why we store
-- storage_path here even though the URL is what the <img> ultimately
-- needs: paths are stable, URLs are not.
-- =====================================================================
CREATE TABLE case_attachments (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),

  file_name TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,

  storage_bucket VARCHAR(100) NOT NULL,
  storage_path   TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index on case_id since every listing call filters by it.
CREATE INDEX idx_case_attachments_case_id ON case_attachments(case_id);

-- =====================================================================
-- In-app notifications: one row per delivered notification to a single
-- recipient (user_id). Created best-effort by other modules — e.g. the
-- registrar review flow inserts a row for the case lawyer when a case is
-- accepted or returned. Every read/write is scoped to the recipient's
-- user_id so a user only ever sees / marks their OWN rows. case_id is a
-- nullable back-reference to the related case (NULL for non-case-bound
-- notifications); it cascades so deleting a case clears its notifications.
-- =====================================================================
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  message    TEXT         NOT NULL,

  case_id    UUID REFERENCES cases(id) ON DELETE CASCADE,

  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- The bell/list query is "my notifications, newest first" with the unread
-- count derived from the same rows; this composite covers both the scope
-- (user_id), the unread filter (is_read), and the ordering (created_at DESC).
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- Per-user notification preferences. The in-app bell ALWAYS shows every
-- notification; these flags only control which EMAILS a user receives. One row
-- per user (absent row = all defaults TRUE, i.e. opted-in). `email_enabled` is
-- the master switch; the per-category flags gate that category's emails. Auth /
-- security emails (OTP, password reset, account credentials) are essential and
-- are never gated by these. Shared across all roles; each role's settings UI
-- writes here.
CREATE TABLE notification_preferences (
  user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  email_case         BOOLEAN NOT NULL DEFAULT TRUE,
  email_hearing      BOOLEAN NOT NULL DEFAULT TRUE,
  email_message      BOOLEAN NOT NULL DEFAULT TRUE,
  email_document     BOOLEAN NOT NULL DEFAULT TRUE,
  email_payment      BOOLEAN NOT NULL DEFAULT TRUE,
  -- Admin-only categories: a new lawyer awaiting verification, and a lawyer's
  -- payout request. Other roles simply never write/read these (they stay TRUE
  -- and unused), so the table remains shared across all roles.
  email_verification BOOLEAN NOT NULL DEFAULT TRUE,
  email_payout       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Daily active-user ledger. One row per user per day they were active (any
-- authenticated request stamps it, throttled to once/user/day by the backend).
-- Powers the admin Statistics "Active Today" metric and the Daily Active Users
-- trend (registrations history comes from users.created_at; this is the missing
-- "who was active each day" record). The composite PK makes the per-day write
-- idempotent (ON CONFLICT DO NOTHING).
CREATE TABLE user_activity (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, activity_date)
);

-- The aggregates are date-first ("active today", GROUP BY activity_date), which
-- the PK's leading user_id column can't serve — so index activity_date.
CREATE INDEX idx_user_activity_date ON user_activity(activity_date);

-- =====================================================================
-- AI Legal Assistant chat history. Each lawyer's conversations with the
-- grounded AI assistant: one row per conversation in ai_chat_sessions
-- (title auto-derived from the first user message), one row per turn in
-- ai_chat_messages. Every read/write is scoped to the owning user_id so a
-- lawyer only ever sees their OWN chats. Deleting a session cascades to its
-- messages; deleting the user cascades to everything.
-- =====================================================================
CREATE TABLE ai_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title      VARCHAR(120) NOT NULL DEFAULT 'New chat',
  -- Pinned conversations float to the top of the sidebar (ChatGPT-style).
  pinned     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sidebar query: "my sessions, pinned first, then most recently used."
CREATE INDEX idx_ai_chat_sessions_user_updated
  ON ai_chat_sessions (user_id, updated_at DESC);

CREATE TABLE ai_chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,

  role       VARCHAR(10) NOT NULL CHECK (role IN ('user', 'ai')),
  text       TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Loading a conversation + building LLM context: a session's messages in order.
CREATE INDEX idx_ai_chat_messages_session_created
  ON ai_chat_messages (session_id, created_at ASC);

-- =====================================================================
-- Chat: real-time, one-to-one messaging between a CLIENT and a LAWYER. A
-- conversation is a (client, lawyer) PAIR — independent of any case. A
-- client browses the lawyer directory (GET /api/lawyers) and can start a
-- conversation with any registered lawyer; the lawyer sees it in their
-- inbox and replies. Exactly ONE conversation per pair (UNIQUE), created
-- the first time the client opens the chat.
--
-- message_kind:
--   text  -> body holds the text; attachment_* are NULL
--   file  -> a shared document; attachment_* hold the stored object
--   voice -> a recorded voice note; attachment_* + voice_duration_seconds set
-- Attachment bytes live in Supabase Storage (private bucket, see
-- SUPABASE_CHAT_BUCKET) under chat/{conversationId}/{messageId}/{filename};
-- we keep only the storage path here and mint a short-lived signed URL on
-- read. sender_user_id nulls out if the sender's account is deleted, so the
-- message text/history survives ("a former user wrote…").
-- =====================================================================
CREATE TABLE chat_conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Bumped on every new message so inboxes can sort "most recent first".
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (client_user_id, lawyer_user_id)
);

-- Inbox queries: "my conversations, most recently active first" — one index
-- per side since a user is only ever on one side of the pair.
CREATE INDEX idx_chat_conversations_client
  ON chat_conversations (client_user_id, updated_at DESC);
CREATE INDEX idx_chat_conversations_lawyer
  ON chat_conversations (lawyer_user_id, updated_at DESC);

CREATE TABLE chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,

  message_kind    VARCHAR(10) NOT NULL DEFAULT 'text'
                  CHECK (message_kind IN ('text', 'file', 'voice')),

  -- Text content / optional caption. NULL for pure file/voice messages.
  body            TEXT,

  -- File + voice attachment metadata (NULL for plain text messages).
  attachment_storage_path TEXT,
  attachment_name         TEXT,
  attachment_mime         VARCHAR(120),
  attachment_size         BIGINT,
  voice_duration_seconds  INTEGER,

  -- Reply: the message this one is quoting (NULL for a normal message). SET
  -- NULL if the quoted message is later hidden/removed so the reply survives.
  reply_to_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Stamps the last text edit (NULL = never edited) so the UI can show "edited".
  edited_at       TIMESTAMP,

  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- "Delete for me": a message hidden from ONE participant's own view only (the
-- other person still sees it — there is no delete-for-everyone). One row per
-- (message, user) who hid it; listMessages excludes the caller's hidden rows.
CREATE TABLE chat_message_hidden_for (
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);

-- History load + "last message" lookups both filter by conversation + time.
CREATE INDEX idx_chat_messages_conversation_created
  ON chat_messages (conversation_id, created_at);

-- Per-participant read marker. One row per (conversation, user); last_read_at
-- drives both the unread badge (messages newer than this that the user didn't
-- send) and the "seen" tick (the other party's marker passing a message's
-- timestamp). Far cheaper than a per-message read row. Cascades on
-- conversation or user deletion.
CREATE TABLE chat_reads (
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMP NOT NULL DEFAULT NOW(),

  PRIMARY KEY (conversation_id, user_id)
);

-- =====================================================================
-- Signature requests: ONE row PER SIGNER per "Send for signature" action.
-- When a lawyer marks pages with "client + lawyer" both as required
-- signers and hits Send, the backend creates TWO rows — one with
-- signer_role='client' (recipient_user_id = the client's user account)
-- and one with signer_role='lawyer' (recipient_user_id = the lawyer
-- themselves). Each row owns its own slice of page_indices.
--
-- Both signers must be registered LawFlow users (the signing UIs are
-- in-app, authenticated views — no public token URLs). The lawyer
-- composes the request inside the editor, the recipient signs from
-- their own logged-in dashboard. Email is a notification only.
--
-- Lifecycle (per-row, single signer):
--   pending    → row created, awaiting the signer
--   signed     → signer has signed (signature_image + signed_at set)
--   expired    → past expires_at without signing
--   cancelled  → lawyer revoked the request before signing
--
-- The case-level "all signatures complete" state is derived: a case is
-- fully signed when every signature_request for it has status='signed'.
-- When that happens, the backend compiles cases.signed_pdf (Phase 2).
-- =====================================================================
CREATE TABLE signature_requests (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                    UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_by_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The signer this row is FOR. Resolved at create-time by looking up
  -- the user by email (client) or by created_by_user_id (lawyer). The
  -- in-app viewers verify req.user.sub === recipient_user_id before
  -- letting anyone sign, so it doubles as the access-control check.
  recipient_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_role                VARCHAR(20) NOT NULL
                             CHECK (signer_role IN ('client', 'lawyer')),

  -- Groups rows created together in one "Send" action so the lawyer
  -- editor's panel can display them as one batch with per-signer status.
  -- Nullable for future flexibility (e.g., re-sending a single signer
  -- without spawning a new batch); typically populated.
  case_batch_id              UUID,

  -- Frozen snapshot of the document HTML at send time so the in-app
  -- signing viewer renders exactly what the lawyer sent, even if the
  -- lawyer keeps editing the live cases.edited_html afterwards.
  document_html_snapshot     TEXT NOT NULL,

  -- 0-based page indices into the rendered document for THIS signer's
  -- assigned pages. NULL = entire document. JSONB to allow filtering
  -- per-page status badges in the editor if needed.
  page_indices               JSONB,

  -- Captured signature image (base64 PNG data URL from the signing
  -- canvas — either typed-name-on-canvas or a user-uploaded PNG/JPG
  -- converted to data URL). Stored as an audit record of what the
  -- signer drew. NULL until the signer signs.
  signature_image            TEXT,
  -- Per-page PNG captures uploaded by the signer's browser at submit
  -- time: [{ pageIndex, imageDataUrl }, ...]. These ARE the rendered
  -- bytes of the assigned pages with the signature already drawn on
  -- them — the compiler embeds them verbatim into the final signed
  -- PDF, so there's no server-side re-render to drift away from what
  -- the signer actually saw and approved.
  signed_page_images         JSONB,
  signed_at                  TIMESTAMP,

  status                     VARCHAR(30) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'signed', 'expired', 'cancelled')),

  expires_at                 TIMESTAMP NOT NULL,

  created_at                 TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Case events: append-only audit trail of a case's lifecycle.
--
-- One row per meaningful thing that happened to a case — created,
-- submitted/resubmitted, returned, accepted, the two signing events,
-- the signed-PDF compile, and lawyer edits. Written BEST-EFFORT by the
-- owning modules AFTER their primary write commits (a failed event
-- write must never break the underlying action), so this table is a
-- read-time convenience for the admin case-traceability timeline, never
-- a source of truth the app branches on.
--
-- Append-only by convention: nothing UPDATEs or DELETEs a row except the
-- ON DELETE CASCADE from cases(id) (deleting a case discards its trail).
-- actor_user_id ON DELETE SET NULL so removing a user keeps the event but
-- forgets who. payload is a free-form JSONB envelope whose keys vary by
-- event_type (e.g. returned carries reviewRemarks; edited carries
-- changedFields). Signing events (client_signed / lawyer_signed) are NOT
-- written here by the app — they are derived at read-time from
-- signature_requests — but the CHECK still allows them for completeness.
-- =====================================================================
CREATE TABLE case_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  event_type    VARCHAR(40) NOT NULL
                CHECK (event_type IN (
                  'created',
                  'submitted',
                  'resubmitted',
                  'returned',
                  'accepted',
                  'client_signed',
                  'lawyer_signed',
                  'signed_pdf_compiled',
                  'edited',
                  'deleted',
                  'hearing_scheduled',
                  'hearing_completed',
                  'case_disposed'
                )),

  -- Who did it. NULL after the actor's user row is deleted (SET NULL),
  -- or when the event has no single human actor.
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role    VARCHAR(20),

  -- Free-form per-event detail. Shape depends on event_type.
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Payment Module: Service Charges, Agreements, Payment Plans, Installments
-- =====================================================================
CREATE TABLE lawyer_service_charges (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id UUID UNIQUE NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,

  base_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  family_case_fee NUMERIC(12, 2),
  civil_case_fee NUMERIC(12, 2),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE agreements (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lawyer_user_id UUID NOT NULL REFERENCES users(id),
  client_user_id UUID NOT NULL REFERENCES users(id),

  lawyer_base_fee NUMERIC(12, 2) NOT NULL,
  agreed_total_amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR',

  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_agreements_one_per_case UNIQUE (case_id)
);

CREATE TABLE payment_plans (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

  total_amount NUMERIC(12, 2) NOT NULL,
  frequency VARCHAR(30) NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('lump_sum', 'monthly', 'quarterly', 'semi_annual')),
  installment_count INTEGER DEFAULT 1,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE installments (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

  installment_number INTEGER NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  due_date DATE,

  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at TIMESTAMP,
  -- Safepay checkout tracker/beacon for the in-flight payment attempt on this
  -- installment. Provider-neutral name so the column survives a gateway change.
  gateway_checkout_token VARCHAR(255),

  -- When we last emailed an overdue reminder for this installment. NULL = never
  -- reminded. The scheduler uses this to space recurring overdue reminders and
  -- to avoid sending duplicates (see overdueReminders.service.js).
  last_overdue_reminder_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_transactions (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id),
  lawyer_user_id UUID NOT NULL REFERENCES users(id),

  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),

  -- Payment-gateway identifiers (provider-neutral). gateway_checkout_token is
  -- the Safepay tracker/beacon, used as the idempotency key (UNIQUE). gateway
  -- names the provider; gateway_reference holds any secondary provider ref.
  gateway VARCHAR(20) NOT NULL DEFAULT 'safepay',
  gateway_checkout_token VARCHAR(255),
  gateway_reference VARCHAR(255),

  -- Marketplace split, snapshotted at record time so historical rows stay
  -- accurate if the platform commission rate later changes. commission_rate is
  -- a percentage (e.g. 10.00); platform_fee_amount + lawyer_net_amount = amount.
  commission_rate     NUMERIC(5, 2),
  platform_fee_amount NUMERIC(12, 2),
  lawyer_net_amount   NUMERIC(12, 2),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_payment_txn_gateway_token
    UNIQUE (gateway_checkout_token)
);

CREATE TABLE payment_receipts (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL UNIQUE REFERENCES payment_transactions(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL UNIQUE,
  installment_id UUID NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES users(id),
  lawyer_user_id UUID NOT NULL REFERENCES users(id),

  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
  payment_status VARCHAR(30) NOT NULL,

  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Platform settings (singleton row, id pinned to 1). Holds the marketplace
-- commission rate the platform keeps from each client payment.
-- =====================================================================
CREATE TABLE platform_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_settings_singleton CHECK (id = 1),
  -- A commission rate outside 0–100% would corrupt the payment split.
  CONSTRAINT platform_settings_rate_range CHECK (commission_rate >= 0 AND commission_rate <= 100)
);

INSERT INTO platform_settings (id, commission_rate) VALUES (1, 10.00);

-- =====================================================================
-- Payouts: the platform settling a lawyer's accumulated net earnings to their
-- bank account. One row per payout. A lawyer's available balance is DERIVED
-- (sum of lawyer_net_amount from successful transactions) minus payouts that
-- are not cancelled/failed. Bank details are snapshotted from lawyer_profiles
-- at request time so a later profile edit doesn't rewrite history.
-- =====================================================================
CREATE TABLE payouts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  amount   NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
  status   VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'processing', 'paid', 'failed', 'cancelled')),

  -- Snapshot of the destination bank account at request time.
  payout_account_title  VARCHAR(150),
  payout_account_number VARCHAR(50),
  payout_bank_name      VARCHAR(150),

  -- Filled when the admin marks the payout paid/failed.
  reference             VARCHAR(255),
  note                  TEXT,
  processed_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Proof of the manual bank transfer the admin made to the lawyer (Phase-1
  -- admin-confirmed payout). Captured when marking paid. transfer_date +
  -- transfer_bank + reference are shown to the lawyer as their confirmation;
  -- the uploaded receipt image is ADMIN-ONLY (it can reveal the platform's own
  -- bank account), so it lives behind an admin-gated signed-URL endpoint.
  transfer_date          DATE,
  transfer_bank          VARCHAR(150),
  receipt_storage_bucket VARCHAR(100),
  receipt_storage_path   TEXT,

  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Hearing Scheduling Tables
-- =====================================================================

CREATE TABLE courtrooms (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name     VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed courtrooms
INSERT INTO courtrooms (name) VALUES
  ('Court Room 1'),
  ('Court Room 2'),
  ('Court Room 3');

CREATE TABLE holidays (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date   DATE NOT NULL UNIQUE,
  reason VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed Pakistan public holidays (sample for 2025/2026)
INSERT INTO holidays (date, reason) VALUES
  ('2026-02-05', 'Kashmir Day'),
  ('2026-03-23', 'Pakistan Day'),
  ('2026-05-01', 'Labour Day'),
  ('2026-08-14', 'Independence Day'),
  ('2026-09-06', 'Defence Day'),
  ('2026-11-09', 'Iqbal Day'),
  ('2026-12-25', 'Quaid-e-Azam Day / Christmas');

CREATE TABLE hearings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lawyer_user_id  UUID NOT NULL REFERENCES users(id),
  courtroom_id    UUID NOT NULL REFERENCES courtrooms(id),

  hearing_number  INTEGER NOT NULL DEFAULT 1,
  hearing_type    VARCHAR(80) NOT NULL,

  hearing_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,

  status          VARCHAR(30) NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','scheduled','completed','adjourned','cancelled')),

  created_by_registrar_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  -- No double-booking: same room + date + start_time can only be used once
  CONSTRAINT uq_courtroom_slot UNIQUE (courtroom_id, hearing_date, start_time)
);

CREATE TABLE hearing_outcomes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id   UUID NOT NULL UNIQUE REFERENCES hearings(id) ON DELETE CASCADE,

  outcome      VARCHAR(30) NOT NULL
               CHECK (outcome IN ('completed','adjourned','disposed')),
  remarks      TEXT,
  next_hearing_type VARCHAR(80),

  recorded_by_registrar_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Indexes (only for real query patterns; PRIMARY KEY / UNIQUE already
-- get implicit indexes, so do not duplicate them here.)
-- =====================================================================
CREATE INDEX idx_users_role_id ON users(role_id);

-- Admin Statistics page: time-bucketed aggregates over registrations, cases,
-- revenue, and registrar review activity.
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_cases_created_at ON cases(created_at);
CREATE INDEX idx_cases_reviewed_by
  ON cases(reviewed_by_registrar_id)
  WHERE reviewed_by_registrar_id IS NOT NULL;
CREATE INDEX idx_payment_transactions_status_created
  ON payment_transactions(status, created_at);

CREATE INDEX idx_pending_registrations_expires_at  ON pending_registrations(expires_at);
CREATE INDEX idx_pending_registrations_role_id     ON pending_registrations(role_id);
CREATE INDEX idx_pending_registrations_bar_license_number
  ON pending_registrations((profile_data ->> 'barLicenseNumber'))
  WHERE profile_data ? 'barLicenseNumber';

CREATE INDEX idx_auth_sessions_active_user_created_at
  ON auth_sessions(user_id, created_at DESC)
  WHERE is_revoked = false;

CREATE INDEX idx_email_verification_otps_active_user_created_at
  ON email_verification_otps(user_id, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX idx_password_reset_tokens_active_user_created_at
  ON password_reset_tokens(user_id, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX idx_auth_identities_user_id ON auth_identities(user_id);

CREATE INDEX idx_lawyer_verification_documents_profile_id
  ON lawyer_verification_documents(lawyer_profile_id);

CREATE INDEX idx_lawyer_profiles_verification_status
  ON lawyer_profiles(verification_status);

CREATE INDEX idx_lawyer_rejection_history_email
  ON lawyer_rejection_history(email);

CREATE INDEX idx_lawyer_rejection_history_rejected_at
  ON lawyer_rejection_history(rejected_at DESC);

CREATE INDEX idx_case_types_category ON case_types(category, sort_order);

CREATE INDEX idx_cases_lawyer_user_id ON cases(lawyer_user_id);
CREATE INDEX idx_cases_client_user_id ON cases(client_user_id);
CREATE INDEX idx_cases_status         ON cases(status);
-- Registrar review queue: cases for a given tehsil filtered by status.
CREATE INDEX idx_cases_status_tehsil  ON cases(status, assigned_tehsil);

-- Lawyer's editor lists per-case + groups by batch.
CREATE INDEX idx_signature_requests_case_id ON signature_requests(case_id);
CREATE INDEX idx_signature_requests_case_status
  ON signature_requests(case_id, status);
CREATE INDEX idx_signature_requests_case_batch_id
  ON signature_requests(case_batch_id)
  WHERE case_batch_id IS NOT NULL;

-- Client/lawyer dashboards list "my pending signatures" by recipient_user_id.
CREATE INDEX idx_signature_requests_recipient_status
  ON signature_requests(recipient_user_id, status)
  WHERE status = 'pending';

-- Lazy expiry sweep target (status check filter shrinks the index).
CREATE INDEX idx_signature_requests_expires_at
  ON signature_requests(expires_at)
  WHERE status = 'pending';

-- Case events: the admin timeline reads "all events for one case, oldest
-- first", so a (case_id, created_at ASC) composite covers both the scope
-- and the ordering in one index scan. The event_type index supports any
-- future "all rows of type X" filtering.
CREATE INDEX idx_case_events_case_id_created_at
  ON case_events(case_id, created_at ASC);
CREATE INDEX idx_case_events_event_type
  ON case_events(event_type);

-- Payment indexes
CREATE INDEX idx_lawyer_service_charges_lawyer_profile_id
  ON lawyer_service_charges(lawyer_profile_id);

CREATE INDEX idx_agreements_case_id ON agreements(case_id);
CREATE INDEX idx_agreements_lawyer_user_id ON agreements(lawyer_user_id);
CREATE INDEX idx_agreements_client_user_id ON agreements(client_user_id);

CREATE INDEX idx_payment_plans_agreement_id ON payment_plans(agreement_id);

CREATE INDEX idx_installments_payment_plan_id ON installments(payment_plan_id);
CREATE INDEX idx_installments_agreement_id ON installments(agreement_id);
CREATE INDEX idx_installments_status ON installments(status);
CREATE INDEX idx_installments_due_date ON installments(due_date);
-- A Safepay checkout tracker belongs to exactly one installment; enforce it so a
-- token can never resolve to two installments (defense-in-depth for recording).
CREATE UNIQUE INDEX uq_installments_gateway_token
  ON installments(gateway_checkout_token) WHERE gateway_checkout_token IS NOT NULL;

CREATE INDEX idx_payment_transactions_case_id
  ON payment_transactions(case_id, created_at DESC);
CREATE INDEX idx_payment_transactions_client_user_id
  ON payment_transactions(client_user_id, created_at DESC);
CREATE INDEX idx_payment_transactions_lawyer_user_id
  ON payment_transactions(lawyer_user_id, created_at DESC);
CREATE INDEX idx_payment_transactions_installment_id
  ON payment_transactions(installment_id);

CREATE INDEX idx_payment_receipts_case_id ON payment_receipts(case_id);
CREATE INDEX idx_payment_receipts_client_user_id ON payment_receipts(client_user_id);
CREATE INDEX idx_payment_receipts_lawyer_user_id ON payment_receipts(lawyer_user_id);

-- Payout queue + a lawyer's own payout history, newest first.
CREATE INDEX idx_payouts_lawyer_status
  ON payouts(lawyer_user_id, status, created_at DESC);

-- Hearings and Holidays indexes
CREATE INDEX idx_hearings_case_id ON hearings(case_id);
CREATE INDEX idx_hearings_lawyer_date ON hearings(lawyer_user_id, hearing_date);
CREATE INDEX idx_hearings_courtroom_date ON hearings(courtroom_id, hearing_date);
CREATE INDEX idx_hearings_status ON hearings(status);
CREATE INDEX idx_holidays_date ON holidays(date);

-- =====================================================================
-- Row Level Security: deny by default on every table.
-- The Express backend uses SUPABASE_SERVICE_ROLE_KEY (and the local
-- postgres superuser) which bypass RLS, so backend operations continue
-- to work. The frontend never talks to Supabase REST directly. Without
-- these locks, anyone with the public anon key could read refresh-token
-- hashes, OTP hashes, password-reset tokens, and pending PII.
-- =====================================================================
ALTER TABLE roles                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrar_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_verification_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_otps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_identities                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_rejection_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_types                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_type_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lawyer_service_charges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages               ENABLE ROW LEVEL SECURITY;

ALTER TABLE courtrooms                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearings                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hearing_outcomes               ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- Seed data: supported case types (5 civil + 5 family at tehsil level).
-- =====================================================================
INSERT INTO case_types (category, code, display_name, governing_law, sort_order) VALUES
  ('civil',  'civil_recovery_of_money',         'Suit for Recovery of Money',                  'Civil Procedure Code (CPC), 1908',                                       1),
  ('civil',  'civil_permanent_injunction',      'Suit for Permanent Injunction',               'Specific Relief Act, 1877',                                              2),
  ('civil',  'civil_declaration',               'Suit for Declaration',                        'Specific Relief Act, 1877',                                              3),
  ('civil',  'civil_specific_performance',      'Suit for Specific Performance of Agreement',  'Specific Relief Act, 1877',                                              4),
  ('civil',  'civil_possession_of_property',    'Suit for Possession of Property',             'Civil Procedure Code (CPC), 1908',                                       5),
  ('family', 'family_khula',                    'Khula (Wife''s Judicial Divorce)',            'Dissolution of Muslim Marriages Act, 1939 & MFLO, 1961',                 1),
  ('family', 'family_maintenance',              'Maintenance (Wife & Children)',               'MFLO, 1961 & Family Courts Act, 1964',                                   2),
  ('family', 'family_dowry_recovery',           'Recovery of Dowry Articles / Personal Property','Dowry & Bridal Gifts Act, 1976 & Family Courts Act, 1964',             3),
  ('family', 'family_minor_custody',            'Custody of Minors (Hizanat)',                 'Guardian and Wards Act, 1890 & Family Courts Act, 1964',                 4),
  ('family', 'family_conjugal_rights',          'Restitution of Conjugal Rights',              'Family Courts Act, 1964',                                                5);