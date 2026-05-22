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
-- Login: LfAdmin@gmail.com / Admin@123
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
  'LfAdmin@gmail.com',
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
  consultation_fee   NUMERIC,

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

  opposite_party_name VARCHAR(200) NOT NULL,

  -- The lawyer's edited HTML state of the case document. NULL until the
  -- lawyer makes a change — when NULL, the editor renders the freshly
  -- fetched template bytes from case-templates/<category>/<code>.docx.
  -- Inline images (CNICs, photos) live here as data: URLs inside the
  -- HTML, so a single column captures the entire edit state.
  edited_html     TEXT,

  -- draft = lawyer is still drafting / editing
  -- submitted = sent to registrar, awaiting review
  -- returned = registrar bounced it back with remarks
  -- accepted = registrar approved it for filing
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'submitted', 'returned', 'accepted')),

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMP
);

-- =====================================================================
-- Signature requests: a single workflow item where the lawyer sends a
-- snapshot of the case document to a recipient (typically the client)
-- for e-signature. The snapshot is intentionally frozen at send time so
-- the lawyer can keep editing the live document without disturbing an
-- in-flight signature request.
--
-- Lifecycle:
--   pending           → request created, awaiting first signer
--   partially_signed  → at least one required signature collected
--   fully_signed      → all required signatures collected
--   expired           → past expires_at without completion
--   cancelled         → lawyer revoked the request before completion
-- =====================================================================
CREATE TABLE signature_requests (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                    UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_by_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  recipient_email            VARCHAR(200) NOT NULL,
  recipient_name             VARCHAR(200),

  -- Frozen snapshot of the document HTML at the moment of send. The
  -- public signing page renders this verbatim so the client sees the
  -- same content the lawyer sent, even if the lawyer keeps editing.
  document_html_snapshot     TEXT NOT NULL,

  -- Which pages were sent (0-based indices into the rendered document).
  -- NULL means the whole document. Stored as JSONB so we can filter
  -- requests by page if a "per-section status" UI ever needs it.
  page_indices               JSONB,

  -- Token for the public signing link. We store only the SHA-256 hash so
  -- a leaked database dump can't grant signing access — the plaintext
  -- token only ever exists in the email body and the URL the client
  -- clicks. Same pattern as auth_sessions.refresh_token_hash.
  token_hash                 VARCHAR(64) NOT NULL UNIQUE,

  -- Required signers. Defaults reflect the common case: client signs,
  -- lawyer signs separately later (or not at all).
  requires_client_signature  BOOLEAN NOT NULL DEFAULT TRUE,
  requires_lawyer_signature  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Captured signatures, as base64 PNG data URLs from the signature pad
  -- canvas. Stored inline because they're tiny (a few KB each) and
  -- tightly coupled to the request row.
  client_signature_image     TEXT,
  client_signed_at           TIMESTAMP,
  lawyer_signature_image     TEXT,
  lawyer_signed_at           TIMESTAMP,

  status                     VARCHAR(30) NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'partially_signed', 'fully_signed', 'expired', 'cancelled')),

  expires_at                 TIMESTAMP NOT NULL,

  created_at                 TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Indexes (only for real query patterns; PRIMARY KEY / UNIQUE already
-- get implicit indexes, so do not duplicate them here.)
-- =====================================================================
CREATE INDEX idx_users_role_id ON users(role_id);

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
CREATE INDEX idx_cases_status         ON cases(status);

-- token_hash already gets a UNIQUE index implicitly; only add what's
-- needed for real query patterns.
CREATE INDEX idx_signature_requests_case_id ON signature_requests(case_id);
CREATE INDEX idx_signature_requests_case_status
  ON signature_requests(case_id, status);
CREATE INDEX idx_signature_requests_expires_at
  ON signature_requests(expires_at)
  WHERE status IN ('pending', 'partially_signed');

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
ALTER TABLE cases                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests             ENABLE ROW LEVEL SECURITY;

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


