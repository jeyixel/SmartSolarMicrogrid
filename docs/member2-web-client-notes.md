# Member 2 — Web Client (Backoffice)

Companion to [member2-station-module-plan.md](member2-station-module-plan.md)
and [member2-implementation-notes.md](member2-implementation-notes.md). This
covers the Backoffice/Grid Operator screens that consume the station API.

---

## What it does

Section 2 of the assignment brief, screen by screen:

| Requirement | Where |
|---|---|
| Create/register a solar grid hub | `/stations/new` |
| View and manage existing hubs | `/stations` — searchable, filterable, paged |
| Update station information | `/stations/:id/edit` |
| Configure GPS location | Click-to-place map + numeric fields, both screens |
| Configure capacity | Capacity and storage section of the form |
| Configure battery storage slots | Total and available slots, with the invariant checked |
| Manage operational schedule | Seven-day editor with per-day open/closed |
| Deactivate only when no active reservations | Deactivate dialog, guarded by the pre-check |

---

## File map

```
web-client/src/
├── api/
│   ├── types.ts            the API contract, mirrored in TypeScript
│   └── client.ts           fetch wrapper, ApiError, identity headers
├── context/
│   └── SessionContext.tsx  which role the session acts as
├── components/
│   ├── AppLayout.tsx       header, nav, role switcher
│   ├── ErrorAlert.tsx      renders the API's error envelope
│   ├── DeactivateDialog.tsx   the business rule, surfaced to the operator
│   ├── LocationPicker.tsx  Leaflet map, click or drag to place the pin
│   ├── ScheduleEditor.tsx  seven-day opening hours
│   ├── StationStatusBadge.tsx
│   └── ui/                 button, input, card, label, badge
├── pages/
│   ├── StationListPage.tsx
│   ├── StationFormPage.tsx     create and edit share one component
│   └── StationDetailPage.tsx
└── App.tsx                 routes
```

---

## Design decisions worth defending

**The client never enforces a rule — it only explains one.**
Every validation in the form is duplicated on the server, and the server is the
one that counts. The form's copy of the rules exists to save a round trip and to
put the message next to the field that caused it. This is the point to make in
the report: a rule enforced only in the browser is not enforced at all, because
anyone can call the API directly.

**Numeric fields are held as strings until submit.**
A number input bound to a number cannot hold `6.` or `-` while you are typing,
and coercing early turns an empty field into `0` — which would sail past a
"capacity is required" check while meaning the opposite. Parsing happens once,
in `validate()`.

**Deactivation asks before it tells.**
Pressing *Deactivate* first calls `GET /api/stations/{id}/deactivation-eligibility`,
the read-only pre-check. The dialog then shows either a green "no active
reservations" panel or an amber one naming the count, and the confirm button is
disabled in the blocked case. The actual `PATCH` re-checks server-side and is
what really refuses — the pre-check is a courtesy, not the enforcement. Both
paths are worth screenshotting.

**One error component for the whole app.**
The backend returns a single error envelope, so `ErrorAlert` is the only place
that decides how a failure looks. It branches on `errorCode`, never on the
message text. Two codes get special handling because a generic red box would
lose the point:

- `STATION_HAS_ACTIVE_RESERVATIONS` reads the count out of `details` and
  explains *why* the refusal exists.
- `RESERVATION_SERVICE_UNAVAILABLE` says the station was deliberately left
  active, so the operator does not read a 503 as "it probably worked".

**Leaflet driven through refs, not react-leaflet.**
A map is an imperative object with its own lifecycle; wrapping it in components
adds a layer without adding much here. The coordinates stay the source of truth
— the numeric inputs and the map are two views of the same two numbers, and
editing either updates the other. The map only re-centres when the pin leaves
the visible area, so typing a latitude does not yank the view on each keystroke.

> **Bundling note worth keeping.** Leaflet's default marker icon resolves its
> images by relative URL, which breaks once Vite hashes assets — the marker
> silently disappears in the production build. Building the icon from
> `new URL(..., import.meta.url)` fixes it, and it is the kind of thing that only
> shows up after `npm run build`, never in dev.

**`stationCode` is disabled, not hidden, when editing.**
Hiding it would leave the operator wondering where it went. Showing it disabled,
with the hint "Cannot be changed after creation", teaches the rule. The update
request omits the field entirely.

---

## Running it

```
cd web-client
npm install
npm run dev          # http://localhost:3000
```

The backend must be running on `http://localhost:5127` (its default `http`
profile). To point elsewhere, copy `.env.example` to `.env.local` and set
`VITE_API_BASE_URL`.

`appsettings.Development.json` now lists `http://localhost:3000` and
`http://127.0.0.1:3000` under `Cors:AllowedOrigins`, so the browser can reach
the API.

### Acting as a role

The header has a role switcher — Backoffice, Grid Operator, Prosumer. It sets
the `X-Debug-Role` and `X-Debug-UserId` headers that the backend's
development-only authentication handler reads, and the choice is remembered in
`localStorage`.

What each role sees, which is the permission matrix made visible:

| | Backoffice | Grid Operator | Prosumer |
|---|---|---|---|
| Station list | ✅ | ✅ | message explaining it is staff-only |
| Register station | ✅ | button hidden | button hidden |
| Edit station | ✅ all fields | operational fields only | ❌ |
| Deactivate / reactivate | ✅ | buttons hidden | buttons hidden |

The UI hides what a role cannot do, but the backend is what refuses it. Switching
to Backoffice here grants nothing a real token would not — worth stating in the
report, and easy to demonstrate by switching to Grid Operator and watching a
capacity change come back 403.

---

## Screenshots to capture

Beyond the list in section N of the plan, these are the web-client ones:

1. Station list showing Active, Inactive and Maintenance rows together.
2. The search box filtering by name, and the status filter applied.
3. Create form with the map pin placed and coordinates filled in.
4. A validation failure — invalid coordinates reads most clearly.
5. The deactivate dialog showing **no active reservations** (green panel).
6. The deactivate dialog **blocked**, showing the count (amber panel). This is
   the headline evidence for the business rule.
7. An inactive station's detail page, with the out-of-service banner and reason.
8. The same list as Grid Operator, with the register button absent.
9. A Grid Operator attempting a capacity change and receiving the 403.

Screenshots 5 and 6 need Member 3's module, or a temporary stub returning a
non-zero count — see below.

---

## Demonstrating the blocked path before Member 3 is ready

The stub in the backend returns 0, so every deactivation currently succeeds and
screenshot 6 is unobtainable. To produce it, change
`StubReservationAvailabilityService.GetActiveReservationCountAsync` to return a
fixed non-zero number, run the two dialog screenshots, then change it back. Note
in the report that this was a stub, not a real reservation — claiming otherwise
would misrepresent the evidence.

---

## Still to do

- [ ] **Replace the role switcher with Member 1's login.** Two files change:
      `api/client.ts` (send `Authorization: Bearer <token>` instead of the debug
      headers) and `context/SessionContext.tsx` (read the role from the token
      rather than from a dropdown). Delete the amber development banner in
      `AppLayout.tsx`.
- [ ] **Confirm the role strings** match Member 1's issuer exactly — they are in
      `api/types.ts` as `USER_ROLES` and must agree with the backend's
      `ApplicationRoles`.
- [ ] **Set `Cors:AllowedOrigins`** for wherever the web client is hosted in the
      IIS deployment, not just localhost.
- [ ] **Code-split if the bundle matters.** It is 505 kB (158 kB gzipped), mostly
      Leaflet and the router. Fine for a university demo; `manualChunks` would
      halve the initial load if you want to mention it.
- [ ] **No tests yet.** `package.json` has no test runner configured. The
      scaffold's `App.test.tsx` was removed rather than left broken — it rendered
      `App` without a router, so it would have failed the moment a runner was
      added. If you add Vitest, `validate()` in the form page and the
      `errorCode` branching in `ErrorAlert` are the highest-value targets.
