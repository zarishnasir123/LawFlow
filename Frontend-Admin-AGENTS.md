# Frontend-Admin-AGENTS.md — admin panel

Rules for AI agents and contributors working inside `Frontend-Admin/`.

`AGENTS.md` (same folder) covers cross-cutting rules — security, DB,
auth, roles, backend conventions. `Frontend-AGENTS.md` covers the main
user-facing app. **This** file covers what is specific to the admin panel.

## What this app is

A **standalone Vite app** for the **admin** role only. Lives at `:5174` in
local dev. Admins log in here and only here — the main `Frontend/` app at
`:5173` never accepts admin credentials.

Keeping admin isolated:

- Reduces blast radius if the main app's UI is compromised (an XSS in a
  user-facing page can't reach admin session state).
- Lets us ship the admin bundle with a smaller dependency surface.
- Allows different deploy / hosting constraints in production.

## Stack

```text
React 19 + TypeScript
Vite + @vitejs/plugin-react-swc
TanStack Router      (code-based; pathless layout route _admin owns the sidebar)
TanStack Query       (server state — every list/detail fetch goes through it)
Zustand              (local + persisted client state; use sparingly)
React Hook Form      (every form)
Axios                (one shared client; same refresh interceptor design as main)
Tailwind CSS v4      (tokens via @theme; brand colour #01411C)
lucide-react         (icons — never another icon library)
recharts             (admin charts only; do not pull chart.js too)
```

Intentionally NOT here: Tiptap, pdf-lib, react-pdf, dnd-kit, chart.js,
react-dropzone. Admin tasks don't need them. Resist adding them.

## Folder structure

```text
Frontend-Admin/src/
  app/
    App.tsx           mounts QueryClientProvider + RouterProvider
    router.tsx        full route tree, including _admin layout route
    routeGuards.ts    requireAdmin() — redirects non-admins to /login
  modules/
    auth/             admin login, password reset
    admin/            every admin feature
      api/            HTTP clients (one file per resource: registrars.ts,
                      lawyerVerifications.ts, lawyerRejections.ts, …)
      components/     AdminLayout (sidebar + outlet), shared admin UI,
                      modals subfolder
      pages/          one file per route (Dashboard, Registrars, Verifications,
                      RejectionHistory, Cases, Finances, Payouts, Templates, …)
      store/          Zustand stores: notifications, templateCases (template
                      data). Add new ones sparingly.
      data/           static mock data — clearly labelled (*.mock.ts)
      types.ts        admin-side shared types
  shared/
    api/              axios instance + cross-page API helpers
                      (e.g. extractApiErrorMessage)
  styles/             Tailwind globals + theme tokens
```

Do not split `admin/` into role-flavoured subfolders — there's only one
role here. Group by resource (registrars, lawyer verifications, templates)
instead.

## Routing

- Code-based TanStack Router. Single route tree in `app/router.tsx`.
- **Pathless layout route** `_admin` (id starts with `_` per TanStack
  convention) wraps every admin page so the sidebar + chrome render once
  and child routes mount in `<Outlet />`. Adding a new admin page = add a
  child route under `adminLayoutRoute`; do not duplicate the layout per
  page.
- `beforeLoad: requireAdmin()` lives on the layout route, not on each
  child. One place to enforce, one place to update.
- Route IDs leak into typed `from` strings under a pathless layout. If
  you use `useParams({ from: "…" })`, prefix with `/_admin/`. Don't
  rename the layout id without sweeping every `from` literal.
- Use `<Link to="…">` from `@tanstack/react-router`. Anchor tags trigger
  full reloads and wipe the in-memory access token.

## State: which tool for which job

- **TanStack Query** — anything from the backend. List endpoints, detail
  endpoints, mutations.
  - Query keys: `["admin", "<resource>", ...filters]`. See
    `pages/Verifications.tsx` and `pages/RejectionHistory.tsx` for the
    canonical pattern.
  - On a successful mutation: `queryClient.invalidateQueries({ queryKey: ["admin", "<resource>"] })`.
    Don't splice cache by hand.
- **Zustand** — persistent local state only. Today: notifications store
  and template-case store. New stores need a real justification —
  prefer TanStack Query for anything the backend can own. **Never**
  cache backend records in Zustand; they go stale and `invalidateQueries`
  can't reach them.
- **`useState` / `useReducer`** — every modal open/closed, form draft,
  toast visibility, drawer toggle.

Storage rules are non-negotiable: **never** put access tokens, refresh
tokens, OTPs, password-reset tokens, CNICs, document URLs, or signature
blobs in any persisted store (`persist`, localStorage, sessionStorage,
IndexedDB).

## API calls

- Always import `apiClient` from `shared/api/axios.ts`. No ad-hoc axios
  instances.
- One API file per resource under `modules/admin/api/`. Each function:
  - calls `apiClient.<method>` with typed request/response,
  - returns the parsed payload (`data.registrar`, not the full Axios
    response wrapper),
  - does **nothing else** — no React, no toasts, no router calls.
- Surface backend error messages via
  `shared/api/extractApiErrorMessage.ts`. Don't re-implement the
  axios-error → message logic in pages.
- `VITE_API_URL` selects the backend base URL; fall back to
  `http://localhost:5000/api` in dev.

## Auth

- Single role only. Admin logs in via `POST /auth/login` with
  `expectedRole: "admin"`. Wrong-role attempts return the generic
  invalid-credentials message — preserve that, don't add chatty errors.
- Access token in module-local memory inside
  `modules/auth/utils/authStorage.ts`. Refresh token in an httpOnly
  cookie set by the backend.
- `requireAdmin()` in `app/routeGuards.ts` is defence-in-depth, not the
  security boundary. Backend `authenticate + authorizeRoles("admin")`
  is the real check.
- Admins do **not** sign in via Google. Local password flow only.
- Logout: call `clearStoredAuth()` (drops in-memory token + the
  `user` key) and `navigate({ to: "/login" })`. Avoid
  `localStorage.clear()` — wipes unrelated persisted Zustand state.

## AdminLayout (sidebar)

- Source of truth for sidebar items is the `navItems` array in
  `modules/admin/components/AdminLayout.tsx`. Add a new admin page =
  add a route in `router.tsx` and an entry here.
- Active route highlight uses the `matchPrefixes` field — set it when
  a parent label should stay active for child routes (e.g. Registrars
  stays lit while on `/registrars/create` and `/registrars/edit/$id`).
- Collapse/expand state persists in `localStorage` under
  `lawflow_admin_sidebar_collapsed`. Don't reuse that key for anything
  else.
- Mobile drawer is a separate, transient state — not persisted.
- The Notifications nav entry shows the unread count via
  `useAdminNotificationsStore`. Don't fetch unread count over HTTP for
  the sidebar; if/when notifications move to the backend, expose the
  unread count via a small `useQuery` and replace the store read.

## Forms

- `react-hook-form` for every form. Submit handler delegates to a
  TanStack Query mutation — never juggle `isSubmitting` manually.
- Show server-side validation messages via `extractApiErrorMessage`.
- Identity fields (email, CNIC) on edit pages must be **read-only**:
  the backend rejects changes to them after creation, so the form
  should match.
- For shared create/edit forms (see `RegistrarForm.tsx`), expose an
  `editMode` prop to gate the read-only behaviour instead of forking
  the component.

## Styling

- Tailwind v4 only. No CSS modules, no styled-components, no
  `style={{...}}` except for genuinely dynamic numeric values
  (column widths, dynamic offsets).
- Brand colour: `#01411C`. Use directly until we promote it to a theme
  token in `styles/`.
- `clsx` (already a dep) for conditional class names. Don't add
  `classnames`.
- Icons: `lucide-react`. Do not add another icon library.

## Component patterns

- Pages own data fetching + mutations + toasts. Child components are
  presentational and take plain props.
- Modals: one component per modal under `components/modals/`. The
  parent page owns the open/closed state.
- Status feedback: use the existing `StatusToast` component (consistent
  type/title/message API). Don't write a new toast system.
- Avoid `useEffect` for derived state. ESLint's
  `react-hooks/set-state-in-effect` is enforced — if you need to react
  to a route change, do it in the `onClick` of the navigation source
  instead of an effect on `location.pathname`.

## Security rules (admin-specific)

- The admin panel is a higher-value target than the main app: a single
  XSS here can rotate registrar passwords, suspend lawyers, and read
  audit history. Treat every dep update and every dynamic-`innerHTML`
  pattern with that in mind.
- Never `dangerouslySetInnerHTML` from any value that touched user
  input or the network.
- Surface email-delivery status from credential endpoints
  (`emailDelivery.emailSent`) — when SMTP fails, the temporary password
  has been rotated server-side even though the email didn't reach the
  registrar. The admin needs to *see* that distinction so they don't
  spam the resend button.
- Treat the response from
  `POST /api/registrars` / `POST /api/registrars/:id/resend-credentials`
  as the only source of truth for the new credentials state — never
  retain or display the plaintext password the admin typed.
- `user.role` from `localStorage` is a UI hint, not authorisation. The
  backend is the boundary.

## Lawyer verification and CNIC OCR (`Verifications.tsx`)

The admin **Verifications** page (`/verifications`) is where pending lawyers
are reviewed. CNIC OCR is an advisory check on top of manual document review.

Flow:

- Pending list: `GET /api/auth/lawyers/pending` via `lawyerVerifications.ts`
- Check OCR: `POST /api/auth/lawyers/:lawyerProfileId/verify-cnic`
- Approve/reject: `PATCH /api/auth/lawyers/:lawyerProfileId/review`
- Suspend/reinstate active lawyers from the Active tab

UI rules:

- Drive badges and the Check/Retry OCR button from
  `lawyer.cnicVerificationStatus` (`not_checked` | `matched` | `mismatch` |
  `unreadable`). **Do not** infer state from substrings in `cnicMatchRemarks`.
- Hide Check OCR only when status is `matched`. Keep **Retry OCR** visible for
  `mismatch` and `unreadable` — OCR can misread a card.
- On OCR success, show `StatusToast` with outcome-specific title/message from
  the API response (`matched` → success toast; `mismatch` / `unreadable` → error
  toast with remarks). Network/Gemini failures use the existing error toast.
- The manual verification checklist (license number verified, card matches
  records) is optional and does **not** gate Approve.

API types live in `modules/admin/api/lawyerVerifications.ts`. Extend
`PendingLawyer` and `VerifyCnicResponse` there — don't duplicate types in pages.

## React Query conventions

- Query keys are tuples starting with `"admin"`, then resource, then
  filters: `["admin", "registrars"]`, `["admin", "lawyer-rejections", searchTerm]`.
- Mutations don't reach into the cache directly. On success,
  `queryClient.invalidateQueries({ queryKey: ["admin", "<resource>"] })`
  and let Query re-fetch.
- Use the global `QueryClient` from `App.tsx`. Don't instantiate per
  page.

## Anti-patterns (don't ship these)

- `axios.create(...)` inside a page or module file — use `apiClient`.
- `useState` to hold a server list — use TanStack Query.
- A new persisted Zustand store for backend data — Query owns server
  state.
- Adding `chart.js` when `recharts` already covers the chart we need.
- Hand-rolled `extractApiErrorMessage` clones — import the shared
  helper.
- `localStorage.clear()` to log out — wipes sidebar collapse state and
  any future persisted prefs. Use `clearStoredAuth()`.
- A new modal toast system — extend `StatusToast`.

## Comments

Same rule as `AGENTS.md`:

- Add comments only when they explain business logic, security
  decisions, or non-obvious code.
- Do not add comments that simply repeat what the code already says.
- Don't reference the current task, PR, or callers.

## When you finish a task

- Run `npm run dev` from the repo root (or `Frontend-Admin/`) and exercise the
  actual feature in a browser at `:5174`. Type-checks and lints are necessary,
  not sufficient.
- Run `npm run build` (includes `tsc -b`) before declaring done.
- Pre-existing lint warnings in `RegistrarForm.tsx`, `Verifications.tsx`,
  and `SuspendLawyerConfirmationModal.tsx` are tracked separately; your
  PR shouldn't add new ones.
- If you cannot test the UI, say so explicitly instead of claiming
  success.
