# Backend Models

This folder stores the database model for the backend while we are using raw SQL with PostgreSQL.

- `schema.sql` is the current source-controlled schema for `lawflow_db` — apply it to set up a fresh database.
- Upgrade scripts for already-existing databases live next to `schema.sql` with an ISO date prefix, e.g. `2026-05-11_rejection_history_and_cleanup.sql`. Run them with:
  ```
  psql -U postgres -d lawflow_db -f src/models/<file>.sql
  ```
  Each upgrade script is written to be idempotent (safe to re-run).
- Files that target the Supabase project (not the LawFlow local Postgres) are named `supabase_*.sql` and are intended to be pasted into the Supabase SQL Editor.
- Keep schema changes here when tables, constraints, indexes, or seed roles change.
- Do not put passwords, JWT secrets, SMTP credentials, or private document files in this folder.
- If/when the backend adopts a migration runner (e.g. `node-pg-migrate`), move the date-prefixed files into a `migrations/` subfolder at that point — not before.
