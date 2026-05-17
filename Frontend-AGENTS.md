# Frontend-AGENTS.md — main user-facing app

Rules for AI agents and contributors working inside `Frontend/`.

`AGENTS.md` (same folder) covers cross-cutting rules — security, DB,
auth, roles, backend conventions. **This** file covers what is specific
to the main user-facing app. `Frontend-Admin-AGENTS.md` covers the
separate admin panel.

When two files disagree, the more specific file wins, but in practice
they should never disagree — flag it in review if they do.

## What this app is

The main user-facing app for the **client**, **lawyer**, and **registrar**
roles. Lives at `:5173` in local dev. Admins do **not** sign in here — they
use the separate `Frontend-Admin/` Vite app at `:5174`.

Stack:

```text
React 19 + TypeScript
Vite + @vitejs/plugin-react-swc
TanStack Router      (code-based route tree, not file-based)
TanStack Query       (server state, never local UI state)
Zustand              (local + persisted client state)
React Hook Form      (every form)
Axios                (one shared client; refresh interceptor)
Tailwind CSS v4      (tokens via @theme, no inline styles)
lucide-react         (icons — never another icon library)
Tiptap, react-pdf, pdf-lib, dnd-kit, chart.js, recharts (feature-specific)
```

## Folder structure

```text
Frontend/src/
  app/                application shell
    App.tsx           mounts QueryClientProvider + RouterProvider
    router.tsx        full route tree
    routeGuards.ts    requireAuth() role-based redirect
  modules/            feature modules grouped by domain / role
    auth/             login, register, OTP, password reset, OAuth
    client/           client-side dashboard, profile, cases, hearings, payments
    lawyer/           lawyer-side dashboard, case filing, document editor, signatures
    registrar/        registrar-side dashboard, case review (note: backend wiring
                      for registrar login still pending — currently a local mock)
    marketing/        landing page
    payments/         shared payment screens
  shared/             code reused across more than one module
    api/              axios instance + shared API helpers
    components/       cross-module UI primitives
    hooks/            cross-module hooks
    types/            cross-module types
    utils/            cross-module utilities
  styles/             Tailwind globals + theme tokens
```

Inside a module, follow this pattern. Do not invent extra folders unless the
feature really needs them.

```text
modules/<feature>/
  api.ts              or api/<endpoint>.ts — HTTP calls only, no business logic
  components/         feature-scoped React components
  pages/              top-level route components
  store.ts            Zustand store, if the feature needs persisted local state
  types/              feature-scoped TypeScript types
  utils/              feature-scoped helpers
  data/               static seed/mock data (mark clearly as mock)
```

Do not create empty placeholder folders just to match this list. Add a
folder only when the file you're writing belongs there.

## Routing

- Use TanStack Router's **code-based** API (`createRoute`/`createRouter`).
  Do not introduce the file-based router on top of it.
- Every route lives in `app/router.tsx`. Grouped by module with comment
  headers, not by file split.
- Protect role-specific routes with `requireAuth([role])` from
  `app/routeGuards.ts`. Marketing and auth pages are unguarded.
- Use `<Link to="…">` from `@tanstack/react-router`. Do not use anchor tags
  for in-app navigation.
- Use `useParams({ from: "/exact/route/$id" })` so TypeScript catches
  rename mismatches. If route IDs leak into the typed `from` (e.g. behind
  a pathless layout route), update the `from` literal — don't loosen the
  typing with `strict: false`.

## State: which tool for which job

- **TanStack Query** — anything that comes from the backend. Lists, single
  records, mutations. Never put server data in Zustand or `useState`.
  - Query keys: `["<module>", "<resource>", ...filters]` — see existing
    examples in `modules/admin/pages/RejectionHistory.tsx` over in
    Frontend-Admin for the canonical shape (same pattern applies here).
  - On a mutation, `queryClient.invalidateQueries` rather than manually
    splicing the cache.
- **Zustand** — local app state that needs to survive route changes or
  reloads. Login role memory, profile drafts, multi-step wizard state.
  Use the `persist` middleware when survival across reload matters; use
  bare `create` when it doesn't.
- **`useState` / `useReducer`** — anything component-local: form UI,
  modal open/closed, hover, drawer toggles.

Never store the access token, refresh token, OTP, CNIC, password, or
private document URL in Zustand or any storage that JS can read freely.

## API calls

- Always import `apiClient` from `shared/api/axios.ts`. Do not
  `axios.create(...)` ad-hoc.
- Each module owns its own `api.ts` (or `api/` folder) that:
  - calls `apiClient.<method>` with a typed response,
  - maps request/response shapes if the backend convention diverges,
  - does **nothing else** — no React, no state, no toasts.
- `VITE_API_URL` selects the backend base URL; fall back to
  `http://localhost:5000/api` in dev.
- Auth flow:
  - Access token is in module-local memory inside
    `modules/auth/utils/authStorage.ts`. Read via
    `getInMemoryAccessToken()`, write via `setInMemoryAccessToken()`.
    Don't bypass these helpers.
  - The response interceptor in `shared/api/axios.ts` catches 401s,
    fires `/auth/refresh` against the httpOnly cookie, retries the
    original request. Skip paths in `AUTH_PATHS_SKIP` if you add new
    auth endpoints — refreshing on `/auth/login` itself would loop.
  - Pass `expectedRole` on `/auth/login` so wrong-role attempts get the
    generic invalid-credentials message instead of leaking role info.

## Forms

- Use `react-hook-form` for every form with two or more inputs. No
  controlled-state-per-field DIY forms.
- Submit handler should be `mutation.mutate(values)` — let the
  TanStack-Query mutation own loading/error UI, not the form's
  `isSubmitting`.
- Server-side validation messages: surface them from the API error via
  `getAuthErrorMessage` (auth) or
  `shared/api/extractApiErrorMessage` (everything else).

## Auth & session storage

- The `user` key in localStorage / sessionStorage contains the **public
  user profile only**: id, email, role, display name, optional
  `rememberMe` and refresh-token expiry. No tokens, no CNIC, no phone,
  no document references. Helpers:
  - `getStoredAuthUser()` reads (session first, then local — matches
    rememberMe semantics).
  - `saveStoredAuthUser(user, rememberMe, accessToken)` writes.
  - `clearStoredAuth()` wipes both.
- Cross-tab logout works via a `storage` event listener in
  `authStorage.ts`. Don't add a competing listener on the same key.
- `requireAuth([roles])` is **defence-in-depth**, not the security
  boundary. The backend is the security boundary. The guard's job is
  to stop the UI flashing pages the visitor can't actually use.

## Styling

- Tailwind v4 only. No CSS modules, no styled-components, no inline
  `style={{...}}` except for genuinely dynamic values (chart width,
  positioning of dragged elements, etc.).
- Brand colour is `#01411C`. Use it directly rather than redefining
  per-file. If we need a real palette, add it to `styles/` as a Tailwind
  `@theme` token first.
- Use `clsx` (already a dep) for conditional class names; do not pull
  in `classnames` or hand-roll string concatenation.
- Icons come from `lucide-react`. Do not add another icon library.

## Component patterns

- Pages live in `pages/`, dumb-ish presentational components in
  `components/`. Pages own the data fetching + mutation calls, child
  components receive plain props.
- Modals: one component per modal in `components/modals/`. Modal state
  (open/closed) lives in the parent page, not in the modal itself.
- Forms that exist in both create and edit flows should be a single
  shared component with an `editMode` flag, not two near-duplicates.
- Avoid `useEffect` for derived state. If the value can be computed
  during render, compute it during render or in `useMemo`.
- ESLint's `react-hooks/set-state-in-effect` is enforced. If you find
  yourself setting state from an effect on a route change, hook the
  setter into the `onClick` of the navigation source instead.

## Security rules (frontend-specific)

`AGENTS.md` covers backend security. On the frontend specifically:

- **Never** put access tokens, refresh tokens, OTPs, or password reset
  tokens in `localStorage`, `sessionStorage`, Zustand `persist`, IndexedDB,
  or a URL search param logged to history.
- The access token is in memory; the refresh token is in an httpOnly
  cookie set by the backend. Both rules are non-negotiable.
- Never trust `user.role` from `localStorage` as an authorisation
  decision — it's only an enable-the-right-UI hint. The backend's
  `authenticate + authorizeRoles` is the real check.
- Never log a CNIC, phone number, password, OTP, OAuth `state`, OAuth
  `code`, document URL, or signature blob. Even in dev.
- Never embed secrets (Stripe keys, Supabase service key, JWT secret)
  in this app. Anything in `import.meta.env.VITE_*` ships to the
  browser; treat that namespace as public.

## OAuth specifics

- `/auth/google` redirects through Supabase, comes back to
  `/auth/callback`, which reads the access token from the URL hash and
  POSTs it to `/auth/google/session` along with the CSRF `state`.
- Frontend never talks to Supabase REST directly. Backend uses the
  service role key; frontend uses our own JWT after the round-trip.

## Anti-patterns (don't ship these)

- `axios.create(...)` inside a module file — use `apiClient`.
- `useState` to hold a list of items from the backend — use TanStack
  Query.
- A new Zustand store for one boolean — use component state.
- Manual JSON.parse over a `localStorage` value when reading auth —
  use the typed helpers in `authStorage.ts`.
- Anchor tags (`<a href="/foo">`) for in-app navigation — use
  `<Link>` so the router doesn't fall back to a full page reload.
- Calling `localStorage.clear()` to log out a user — wipes unrelated
  app state (Zustand persists, theme prefs). Use `clearStoredAuth()`.
- A new icon library when `lucide-react` already exports the icon.

## Comments

Same rule as `AGENTS.md`:

- Add comments only when they explain business logic, security
  decisions, or non-obvious code.
- Do not add comments that simply repeat what the code already says.
- Don't reference the current task, PR, or callers — those belong in
  the commit message / PR description.

## When you finish a task

- Run the local dev server (`npm run dev` from `Frontend/`) and try the
  feature in a real browser. Type-checks and lints are necessary, not
  sufficient — feature correctness needs eyes on the UI.
- If you cannot test the UI (no browser available, no fixtures), say so
  explicitly instead of claiming success.
