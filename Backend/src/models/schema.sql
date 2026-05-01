-- LawFlow database schema
-- Run this file against the lawflow_db PostgreSQL database for a fresh setup.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) UNIQUE NOT NULL
);

INSERT INTO roles (name)
VALUES ('client'), ('lawyer'), ('registrar'), ('admin')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id),

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  phone VARCHAR(20),
  cnic VARCHAR(15) UNIQUE NOT NULL,

  -- Nullable because Google OAuth users may not have a local password.
  password_hash TEXT,
  auth_provider VARCHAR(30) NOT NULL DEFAULT 'local',

  email_verified BOOLEAN NOT NULL DEFAULT false,
  account_status VARCHAR(30) NOT NULL DEFAULT 'pending_verification',
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_cnic_format
    CHECK (cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$'),
  CONSTRAINT valid_account_status
    CHECK (account_status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  CONSTRAINT valid_auth_provider
    CHECK (auth_provider IN ('local', 'google'))
);

ALTER TABLE users
  ALTER COLUMN account_status SET DEFAULT 'pending_verification';

CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  address TEXT,
  city VARCHAR(100),
  tehsil VARCHAR(100),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lawyer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  specialization VARCHAR(150) NOT NULL,
  district_bar VARCHAR(150) NOT NULL,
  bar_license_number VARCHAR(100) UNIQUE NOT NULL,
  experience_years INTEGER DEFAULT 0,
  consultation_fee NUMERIC,

  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  verification_remarks TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_lawyer_verification_status
    CHECK (verification_status IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS lawyer_verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_profile_id UUID NOT NULL REFERENCES lawyer_profiles(id) ON DELETE CASCADE,

  document_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  mime_type VARCHAR(100),
  file_size BIGINT,

  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_lawyer_document_type
    CHECK (document_type IN ('law_degree', 'bar_license_card'))
);

CREATE TABLE IF NOT EXISTS email_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Store only the hash. Never store or log a production OTP in plain text.
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Refresh tokens are hashed before storage so leaked DB rows cannot be used directly.
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(100),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  provider VARCHAR(30) NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email CITEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (provider, provider_user_id)
);

-- Remove older redundant indexes. PostgreSQL already creates indexes for
-- PRIMARY KEY and UNIQUE constraints.
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_cnic;
DROP INDEX IF EXISTS idx_lawyer_profiles_user_id;
DROP INDEX IF EXISTS idx_client_profiles_user_id;
DROP INDEX IF EXISTS idx_auth_sessions_refresh_token_hash;

-- Query-focused indexes. Keep these aligned with real service queries.
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user_created_at
  ON auth_sessions(user_id, created_at DESC)
  WHERE is_revoked = false;
CREATE INDEX IF NOT EXISTS idx_email_verification_otps_active_user_created_at
  ON email_verification_otps(user_id, created_at DESC)
  WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_active_user_created_at
  ON password_reset_tokens(user_id, created_at DESC)
  WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_verification_documents_profile_id
  ON lawyer_verification_documents(lawyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_verification_status
  ON lawyer_profiles(verification_status);
