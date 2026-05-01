# Backend Models

This folder stores the database model for the backend while we are using raw SQL with PostgreSQL.

- `schema.sql` is the current source-controlled schema for `lawflow_db`.
- Keep schema changes here when tables, constraints, indexes, or seed roles change.
- Do not put passwords, JWT secrets, SMTP credentials, or private document files in this folder.
- When the backend grows, move from one schema file to ordered migrations without changing table ownership casually.
