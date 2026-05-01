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

Use this structure:

```text
Backend/src/
  config/        app, database, and environment config
  middleware/    auth, RBAC, validation, and error middleware
  modules/       feature modules
  services/      reusable external integrations like email
  utils/         reusable helpers
  app.js
  server.js
```

Feature modules should follow this pattern:

```text
modules/auth/
  auth.routes.js
  auth.controller.js
  auth.service.js
  auth.validators.js
```

Responsibilities:

- Routes only define endpoints and middleware.
- Validators check request input.
- Controllers handle request and response.
- Services contain business logic and database queries.
- Shared services contain reusable external integrations.
- Utils contain small reusable helpers.

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
- When migrations are introduced, use ordered migration files and never edit historical migrations casually.

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
CNICs
private document URLs
case file contents
signatures
```

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
