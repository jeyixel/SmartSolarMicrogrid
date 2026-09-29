# Member 2 — Microgrid Node & Location Services
## Implementation Blueprint (planning only, no code)

---

## A. ARCHITECTURE

### A.1 Where this module sits

The system is a three-tier client–server application:

```
[Web Backoffice client]      [Android client]
          \                        /
           \   HTTPS / REST / JSON /
            \                    /
        ==== ASP.NET Core Web API (IIS) ====
        |  Controllers  (HTTP boundary)     |
        |  Services     (business logic)    |
        |  Repositories (data access)       |
        ====================================
                     |
             MongoDB driver
                     |
              [ MongoDB server ]
```

Your module is one vertical slice of that middle box: a `StationsController`, a
`StationService`, a `StationRepository`, and the `SolarStationInfo` collection.
Nothing outside the API process ever touches MongoDB. Both clients are "dumb"
with respect to rules — they render what the API returns and submit what the
user typed; every rule (coordinate ranges, capacity limits, the deactivation
guard) lives in your service layer, because a rule enforced only in the web form
can be bypassed by anyone calling the API directly.

### A.2 Layer responsibilities (Controller → Service → Repository)

**Controller** — HTTP only. Its jobs: bind and shape-validate the request DTO,
read the caller's role from the authenticated principal, call one service method,
map the service outcome to an HTTP status code and response DTO. It contains no
`if` statements about business meaning. It never sees a MongoDB type.

**Service** — the whole of your module's business logic. It: applies business
validation (uniqueness, state transitions), orchestrates the reservation check
during deactivation, sets audit fields, decides what the caller is allowed to
see (e.g. hiding inactive stations from a Prosumer), and returns a result object
that distinguishes success from each named failure reason. It does not know that
HTTP exists and does not know that Mongo exists — it talks to the repository
through an interface.

**Repository** — persistence only. CRUD against the collection plus the specific
queries you need (find by id, find all with filters, find active within a
bounding area, check name/code uniqueness). It returns domain/entity objects. It
contains no rules; "can this be deactivated?" is never a repository question.

**Why this separation matters for your report:** the deactivation rule needs
data from Member 3's module. If that rule lived in the controller or the
repository, you would either duplicate reservation logic or create a circular
data dependency. In the service layer it is a single call to an injected
abstraction, and Member 3 can change reservation storage freely without touching
your code.

### A.3 How MongoDB fits

- One database for the whole system; each member owns their own collection(s).
  You own `SolarStationInfo`. You do not read Member 3's collection directly —
  that coupling is what the service contract in section I exists to prevent.
- Connection settings (connection string, database name) belong in
  `appsettings.json` bound to a strongly-typed settings class, with the real
  credentials only in `appsettings.Development.json` locally and in IIS
  configuration in deployment. Never commit a production connection string.
- The Mongo client is expensive to construct and internally pooled, so it is
  registered once as a singleton; repositories are scoped and take the client.
- Document ids: use Mongo's `ObjectId` as the `_id`, exposed to clients as its
  24-character hex string. Keep a separate human-facing `stationCode` for
  operators — `_id` is for machines, `stationCode` is for humans.
- Indexes you will want: unique on `stationCode`; a `2dsphere` index on the
  location field if you adopt GeoJSON (see section E); and a plain index on
  `status` since nearly every mobile query filters by it.

### A.4 How the clients consume your APIs

**Web (Backoffice/Grid Operator):** full CRUD screens. A station list with
filters, a create/edit form with a map picker for coordinates, and a deactivate
action that must be prepared to display a rejection ("3 active reservations
block this"). This client sends the bearer token issued by Member 1 on every
call.

**Android:** read-only against your module. It asks for stations near the
device's current position, receives a lightweight list, drops a marker per
station on a Google Map, and on marker tap either uses the summary it already
holds or fetches the full detail document. The map key and map rendering are
purely client concerns — your API only ever returns numbers, never map tiles.
The mobile app is outside your implementation scope; what you owe the project is
the contract in section E.

### A.5 How you talk to Member 3

You define, in your own module, an interface such as
`IReservationAvailabilityService` with essentially one question: *does this
station have any active reservations?* Member 3 implements it and registers the
implementation in DI. In-process this is a direct method call — no HTTP, no
network hop, one transaction boundary, no duplicated rules. Your service depends
on the interface; if Member 3's implementation is not ready yet, you register a
temporary stub that returns "none", and swap it later with zero changes to your
code.

Do not query the reservations collection yourself. The definition of "active"
belongs to Member 3 and will change as their rules evolve.

---

## B. DATABASE DESIGN — `SolarStationInfo`

One document per physical microgrid node.

| Field | Type | Req. | Purpose | Validation | Example |
|---|---|---|---|---|---|
| `_id` | ObjectId | yes (generated) | Primary key; stable machine identifier | Server-generated, never accepted from the client | `652f1a9c4e3b2a0d18c7f901` |
| `stationCode` | string | yes | Human-readable unique identifier used on labels, QR codes, reports | 3–20 chars, uppercase alphanumeric + hyphen, unique across collection, immutable after creation | `"CMB-NORTH-01"` |
| `name` | string | yes | Display name in web lists and map info windows | 3–100 chars, trimmed, not whitespace-only | `"Colombo North Solar Hub"` |
| `description` | string | no | Free-text operator notes, landmarks | max 500 chars | `"Rooftop array, Block B"` |
| `addressLine` | string | no | Postal/street address shown in station details | max 200 chars | `"45 Galle Road, Colombo 03"` |
| `latitude` | double | yes | GPS latitude for map placement | −90 to 90 inclusive; reject non-numeric; reject exactly 0,0 pair as likely-unset | `6.927079` |
| `longitude` | double | yes | GPS longitude for map placement | −180 to 180 inclusive | `79.861244` |
| `capacityKWh` | double | yes | Total energy capacity of the node | > 0, ≤ a sane ceiling (e.g. 100000), at most 2 decimals | `250.5` |
| `totalBatterySlots` | int | yes | Physical battery storage bays installed | ≥ 1, ≤ 1000 | `20` |
| `availableBatterySlots` | int | yes | Currently free bays | ≥ 0 and ≤ `totalBatterySlots` | `7` |
| `status` | string (enum) | yes | Lifecycle state | one of `Active`, `Inactive`, `Maintenance` | `"Active"` |
| `operationalSchedule` | array of objects | no | Weekly opening windows | see sub-schema below | see below |
| `contactPhone` | string | no | Operator contact shown to prosumers | phone pattern, max 20 chars | `"+94112345678"` |
| `createdAtUtc` | DateTime (UTC) | yes | Audit — creation time | server-set, never client-supplied | `2026-09-20T04:10:00Z` |
| `createdByUserId` | string | yes | Audit — who registered it | server-set from the token | `"651a...bc"` |
| `updatedAtUtc` | DateTime (UTC) | no | Audit — last modification | server-set on every write | `2026-09-21T11:02:00Z` |
| `updatedByUserId` | string | no | Audit — who last modified it | server-set from the token | `"651a...bc"` |
| `deactivatedAtUtc` | DateTime (UTC) | no | Audit — when last deactivated | set on deactivate, cleared on reactivate | `null` |
| `deactivationReason` | string | no | Why it was taken offline | max 250 chars when status is Inactive | `"Inverter replacement"` |

**`operationalSchedule` element sub-schema**

| Field | Type | Req. | Purpose | Validation | Example |
|---|---|---|---|---|---|
| `dayOfWeek` | string (enum) | yes | Which day the window applies to | Monday…Sunday; no duplicate day within the array | `"Monday"` |
| `openTime` | string `HH:mm` | yes | Window start (24h, station-local) | valid 00:00–23:59 | `"06:00"` |
| `closeTime` | string `HH:mm` | yes | Window end | valid time, strictly after `openTime` | `"20:00"` |
| `isClosed` | bool | no | Marks the day as fully closed | if true, times ignored | `false` |

**Design decisions worth defending in the report**

- *Embedded schedule, not a separate collection.* The schedule is small,
  bounded (≤ 7 entries), never queried independently, and always read together
  with its station. Embedding gives a single-document read with no joins — the
  exact case document databases are good at.
- *`availableBatterySlots` is stored, not derived.* Deriving it would require
  reading Member 3's reservations on every station read, including every mobile
  map load. Storing it keeps your reads independent; the cost is that Member 3
  or Member 4 must update it as reservations are made and released, which is a
  contract point you should record (see section J).
- *Separate `_id` and `stationCode`.* Operators need a code they can read aloud
  and print; systems need an id that never changes meaning.
- *Flat `latitude`/`longitude` vs GeoJSON.* Flat fields are simpler to validate
  and trivially consumed by Android. If you implement the radius search in
  section E with Mongo's geospatial operators, you additionally store a GeoJSON
  point field and index it; if you implement radius filtering in the service
  layer, flat fields alone suffice. Decide once and state which you chose.

---

## C. API CONTRACT

Base path: `/api/stations`. All responses JSON. All write endpoints require a
valid bearer token from Member 1.

**Conventions used below**
- 401 = no/invalid token (handled by Member 1's middleware, not your code).
- 403 = valid token, wrong role.
- 400 = field validation failure.
- 409 = business-rule conflict (state or uniqueness).
- 422 is deliberately not used; 409 covers rule conflicts to keep the surface small.

---

### C.1 Create station

- **Method / route:** `POST /api/stations`
- **Purpose:** register a new microgrid node.
- **Roles:** Backoffice only. (Grid Operators run stations; they do not create
  them. State this decision explicitly in your report.)
- **Request fields:** `stationCode` (req), `name` (req), `description`,
  `addressLine`, `latitude` (req), `longitude` (req), `capacityKWh` (req),
  `totalBatterySlots` (req), `availableBatterySlots` (req),
  `operationalSchedule[]`, `contactPhone`. Optional `status` limited to
  `Active` or `Inactive`; defaults to `Active`.
- **Response fields:** the full station document as created, including `id`,
  `createdAtUtc`, `createdByUserId`. Return `Location: /api/stations/{id}`.
- **Statuses:** 201 created · 400 validation · 401 · 403 · 409 duplicate
  `stationCode`.
- **Field validation:** all of section B's rules.
- **Business rules:** `stationCode` unique (case-insensitive compare);
  `availableBatterySlots ≤ totalBatterySlots`; audit fields are server-set and
  any client-supplied values are ignored, not echoed.
- **Dependencies:** Member 1 for the authenticated user id and role.

---

### C.2 Get station by id

- **Method / route:** `GET /api/stations/{id}`
- **Purpose:** full detail for one station.
- **Roles:** any authenticated user; the response is role-shaped — Backoffice
  and Grid Operator see audit fields and `deactivationReason`, a Prosumer sees
  only the public projection (see C.8) and receives 404 for a non-Active
  station.
- **Request fields:** `id` in path.
- **Response fields:** full document, or public projection for Prosumers.
- **Statuses:** 200 · 400 malformed id · 401 · 404 not found.
- **Validation:** `id` must be a well-formed ObjectId string — reject malformed
  ids as 400 before hitting the database, rather than letting the driver throw.
- **Business rules:** hiding inactive stations from Prosumers is a 404, not a
  403 — do not disclose that a hidden resource exists.

---

### C.3 Get all stations

- **Method / route:** `GET /api/stations`
- **Purpose:** backoffice management list.
- **Roles:** Backoffice, Grid Operator.
- **Request fields (query):** `status` (filter), `search` (matches name or
  code), `page` (default 1), `pageSize` (default 20, max 100),
  `sortBy` (`name` | `createdAtUtc`, default `name`), `sortDir` (`asc`|`desc`).
- **Response fields:** `items[]` of station summaries, plus `page`, `pageSize`,
  `totalCount`, `totalPages`.
- **Statuses:** 200 · 400 bad paging/sort values · 401 · 403.
- **Validation:** `page ≥ 1`; `pageSize` within 1–100; `status` must be a known
  enum value; `sortBy` must be in the allowed list (never pass a raw client
  string into a sort expression).
- **Business rules:** returns every status, including inactive — this is the
  management view. Always paginate; an unbounded list will not survive a demo
  with seeded data.

---

### C.4 Update station

- **Method / route:** `PUT /api/stations/{id}`
- **Purpose:** edit station details, location, capacity, slots, schedule.
- **Roles:** Backoffice (all fields). Grid Operator may update a narrower set —
  `availableBatterySlots`, `contactPhone`, `operationalSchedule` — and is
  rejected if the payload changes anything else. Pick and document this split.
- **Request fields:** same editable set as create, minus `stationCode` (immutable)
  and minus `status` (changed only through C.5/C.6 so state transitions have one
  code path).
- **Response fields:** the updated document.
- **Statuses:** 200 · 400 · 401 · 403 · 404 · 409 (attempt to change an
  immutable field, or slot invariant broken).
- **Validation:** full re-validation of every supplied field; partial values are
  not trusted because a previous value was valid.
- **Business rules:** `availableBatterySlots ≤ totalBatterySlots` after the
  change; reducing `totalBatterySlots` below currently-reserved slots is a
  conflict — confirm the reserved count with Member 3 if you enforce this;
  `updatedAtUtc`/`updatedByUserId` always refreshed.
- **Dependencies:** Member 1 (role); optionally Member 3 for the slot-reduction
  check.

---

### C.5 Deactivate station

- **Method / route:** `PATCH /api/stations/{id}/deactivate`
- **Purpose:** take a node out of service.
- **Roles:** Backoffice only.
- **Request fields:** `reason` (optional, ≤ 250 chars).
- **Response fields:** updated station, or on rejection an error object carrying
  `activeReservationCount` so the web UI can explain the refusal.
- **Statuses:** 200 · 400 · 401 · 403 · 404 · 409 already inactive · 409 active
  reservations exist.
- **Validation:** id well-formed; reason length.
- **Business rules:** the whole of section D.
- **Dependencies:** Member 3's availability check — mandatory.

---

### C.6 Reactivate station

- **Method / route:** `PATCH /api/stations/{id}/activate`
- **Purpose:** return a node to service.
- **Roles:** Backoffice only.
- **Request fields:** none.
- **Response fields:** updated station.
- **Statuses:** 200 · 400 · 401 · 403 · 404 · 409 already active.
- **Business rules:** no reservation check is needed — reactivating creates no
  conflict. Clear `deactivatedAtUtc` and `deactivationReason`. Include this
  endpoint: without it, deactivation is a one-way door, which no operator would
  accept.

---

### C.7 Nearby stations (mobile map)

- **Method / route:** `GET /api/stations/nearby`
- **Purpose:** the marker feed for the Android map.
- **Roles:** any authenticated user (Prosumer is the primary caller).
- **Request fields (query):** `latitude` (req), `longitude` (req),
  `radiusKm` (optional, default 10, max 100), `limit` (optional, default 50,
  max 200).
- **Response fields:** array of map summaries — `id`, `stationCode`, `name`,
  `latitude`, `longitude`, `availableBatterySlots`, `capacityKWh`,
  `distanceKm`, `isOpenNow`. See section E.
- **Statuses:** 200 (empty array is a valid result, not a 404) · 400 invalid
  coordinates or radius · 401.
- **Validation:** coordinate ranges as in section B; `radiusKm > 0` and within
  the cap; `limit` within range.
- **Business rules:** only `Active` stations are ever returned; results sorted
  by ascending distance; payload deliberately small because it is fetched on
  every map pan.

---

### C.8 Public station detail (map marker selection)

- **Method / route:** `GET /api/stations/{id}/details`
- **Purpose:** what the Android app shows after a marker tap.
- **Roles:** any authenticated user.
- **Request fields:** `id` in path.
- **Response fields:** `id`, `stationCode`, `name`, `description`,
  `addressLine`, `latitude`, `longitude`, `capacityKWh`, `totalBatterySlots`,
  `availableBatterySlots`, `operationalSchedule[]`, `isOpenNow`, `contactPhone`.
  No audit fields, no internal ids.
- **Statuses:** 200 · 400 · 401 · 404 (also returned for an inactive station).
- **Business rules:** this is the public face of a station; keeping it separate
  from C.2 means you can change the backoffice document without breaking the
  mobile app.

*Justification for having both C.2 and C.8:* different audiences, different
fields, different visibility rules. Merging them would force role-branching
inside one response shape and risk leaking audit data to prosumers.

---

### C.9 Additional endpoints genuinely within scope

- **`GET /api/stations/{id}/deactivation-eligibility`** — Backoffice only.
  Returns `canDeactivate` and `activeReservationCount` without changing
  anything. Lets the web UI disable or warn on the button before the operator
  clicks it. Read-only, cheap, and it prevents a confusing failure at the moment
  of action. 200 · 401 · 403 · 404.
- **`GET /api/stations/lookup`** — returns `id`, `stationCode`, `name` for
  active stations only. Member 3 and Member 4 need to populate station dropdowns
  in booking and dashboard screens; without this they would either call C.3
  (which they may not be authorised for, and which is heavy) or query your
  collection directly. 200 · 401.

Do not add: bulk import, station deletion (deactivate is the correct soft
lifecycle), statistics endpoints (Member 4 owns dashboards), or a separate
schedule-management endpoint (the schedule is part of the station document and
is edited through C.4).

---

## D. DEACTIVATION LOGIC

### D.1 The flow

1. Operator clicks "Deactivate" in the Backoffice web app and optionally types a
   reason. The client sends `PATCH /api/stations/{id}/deactivate`.
2. **Controller** validates the id format and reason length, extracts the
   caller's role from the token, and calls the service. If the role is not
   Backoffice, the authorisation layer has already produced 403 and the service
   is never reached.
3. **Service — station existence.** Load the station by id. Not found → return a
   `NotFound` outcome → 404.
4. **Service — state check.** If `status` is already `Inactive`, return
   `AlreadyInactive` → 409. This is checked *before* the reservation call so you
   do not pay for a cross-module query on a no-op request.
5. **Service — reservation check.** Call
   `IReservationAvailabilityService.GetActiveReservationCountAsync(stationId)`.
   - If that call throws or times out, **do not deactivate**. Return a
     `DependencyUnavailable` outcome → 503. Failing closed is the correct choice:
     deactivating a station whose reservation state is unknown could strand a
     prosumer who has already committed to arriving.
6. **Service — decision.** If the count is greater than zero, return
   `BlockedByActiveReservations` carrying the count → 409 with a message naming
   the count.
7. **Service — apply.** Otherwise set `status = Inactive`, `deactivatedAtUtc =
   now (UTC)`, `deactivationReason = reason`, `updatedAtUtc`, `updatedByUserId`,
   and persist.
8. **Controller — respond.** 200 with the updated station.

### D.2 What counts as an "active reservation"

This definition belongs to Member 3, and you should record it in your report as
an agreed contract rather than re-deriving it. The working definition to agree
on: a reservation for this station whose status is `Pending` or `Approved` (i.e.
not `Completed`, not `Cancelled`, not `Rejected`, not `Expired`) **and** whose
scheduled slot time has not yet passed. A completed session or a cancelled
booking places no obligation on the station and must not block an operator.

Note the ordering subtlety worth a sentence in the report: because Member 3
enforces a 7-day booking window, "active" can never reach further than seven
days out, which bounds how long a station can remain un-deactivatable.

### D.3 How Member 3 should expose it

A single synchronous in-process method, described fully in section I. The key
properties: your module asks a question and receives a number or a boolean; it
never receives reservation documents, never interprets reservation statuses, and
never writes to reservation data.

### D.4 Race condition to acknowledge

Between step 5 and step 7, a new reservation could in principle be created. In a
university-scale system the honest handling is: document the window, and have
Member 3's booking service reject bookings against a non-Active station, so the
worst case is a single narrow overlap rather than an open-ended problem. A
production answer would be a transaction or a two-phase "draining" status —
mention it as future work, do not build it.

---

## E. LOCATION / MAP API DESIGN

### E.1 All-stations vs radius search — recommendation

**Support both, with the radius endpoint as the primary path.**

Returning every active station in one payload is simple and, at demo scale (tens
of stations), fast. But it is the wrong contract to hand a mobile client: the
payload grows without bound, it burns mobile data on every map load, and the
phone ends up doing distance maths the server should do. A radius search keeps
the response proportional to what the user can actually see on screen.

Practical compromise for your implementation:

- `GET /api/stations/nearby?latitude&longitude&radiusKm&limit` is the mobile
  default (C.7).
- If the device has no location permission or no fix, the app calls the same
  endpoint without coordinates, or falls back to a capped list of active
  stations sorted by name. Decide one behaviour and document it; the simplest is
  to make `latitude`/`longitude` required and have the app prompt for location.

### E.2 Request contract

Query parameters: `latitude` (double, −90..90, required), `longitude` (double,
−180..180, required), `radiusKm` (double, > 0, ≤ 100, default 10), `limit`
(int, 1..200, default 50).

### E.3 Response contract — the map summary

An array, sorted by `distanceKm` ascending. Per element:

| Field | Type | Why the map needs it |
|---|---|---|
| `id` | string | The key the app passes to C.8 on marker tap |
| `stationCode` | string | Shown in the info window; useful for support calls |
| `name` | string | Marker title |
| `latitude` | double | Marker placement |
| `longitude` | double | Marker placement |
| `capacityKWh` | double | Quick comparison between nearby nodes |
| `availableBatterySlots` | int | The single most decision-relevant number |
| `distanceKm` | double | "2.4 km away" in the info window, and sort order |
| `isOpenNow` | bool | Server-computed from the schedule; avoids making the phone parse time windows and get time zones wrong |

Deliberately excluded: description, address, schedule array, contact, all audit
fields. Those arrive only on marker selection via C.8, which keeps the list
payload small.

### E.4 Implementation approaches (choose and justify)

- **Service-layer distance filter** — fetch active stations, compute Haversine
  distance in C#, filter and sort. Trivial to write and test, no special index.
  Fine at project scale.
- **MongoDB geospatial query** — store a GeoJSON point, add a `2dsphere` index,
  let the database do the filtering and sorting. More work up front, correct
  behaviour at any scale, and a stronger point in your report.

Either is defensible; what matters is that you state the trade-off and that the
*API contract above is identical in both cases*, so you can start with the first
and migrate to the second without the Android app noticing.

### E.5 Bounding-box alternative

If you add map-pan refresh later, a `bounds`-based variant (north-east and
south-west corners) matches map viewports better than a radius. Note it as a
possible extension; do not build it now.

---

## F. VALIDATION

### F.1 Field validation (shape — rejected at the controller boundary, 400)

| Field | Rules |
|---|---|
| `stationCode` | required; 3–20 chars; `^[A-Z0-9-]+$`; trimmed |
| `name` | required; 3–100 chars; not whitespace-only; trimmed |
| `description` | optional; ≤ 500 chars |
| `addressLine` | optional; ≤ 200 chars |
| `latitude` | required; numeric; −90 ≤ v ≤ 90 |
| `longitude` | required; numeric; −180 ≤ v ≤ 180 |
| `capacityKWh` | required; > 0; ≤ 100000; ≤ 2 decimal places |
| `totalBatterySlots` | required; integer; 1–1000 |
| `availableBatterySlots` | required; integer; ≥ 0 |
| `status` | must be one of `Active`, `Inactive`, `Maintenance` |
| `operationalSchedule[].dayOfWeek` | valid day name |
| `operationalSchedule[].openTime` / `closeTime` | `HH:mm`, 00:00–23:59 |
| `contactPhone` | optional; ≤ 20 chars; digits, spaces, `+`, `-` |
| `reason` (deactivate) | optional; ≤ 250 chars |
| `id` (path) | 24-char hex ObjectId |
| paging/sort params | `page ≥ 1`; `pageSize` 1–100; `sortBy` in allow-list |
| `radiusKm` / `limit` | within the caps in E.2 |

### F.2 Business validation (meaning — service layer, 409)

- `stationCode` is unique across the collection, compared case-insensitively.
- `availableBatterySlots ≤ totalBatterySlots` — checked on create and after
  every update.
- `closeTime` strictly after `openTime` within a schedule entry (unless
  `isClosed`).
- No duplicate `dayOfWeek` within `operationalSchedule`.
- `stationCode` is immutable after creation — an update attempting to change it
  is a conflict, not a silent no-op.
- Status changes only via the dedicated endpoints; a `status` field in a PUT
  body is rejected or ignored, documented either way.
- Deactivate is rejected when the station is already `Inactive`.
- Deactivate is rejected when Member 3 reports one or more active reservations.
- Activate is rejected when the station is already `Active`.
- **Duplicate-station guard:** beyond `stationCode`, optionally reject a new
  station whose coordinates fall within ~50 m of an existing active station,
  since two nodes at the same point are almost certainly a data-entry mistake.
  If you implement it, make it a warning-level conflict the operator can
  override with an explicit flag, not a hard block — real sites can host two
  nodes.
- Reducing `totalBatterySlots` below the number currently reserved is a conflict
  (requires Member 3's reserved count; optional scope).
- `latitude`/`longitude` both exactly 0 is treated as unset, not as a valid
  point in the Gulf of Guinea.

### F.3 Authorization validation (identity — 401/403, before any of the above)

- Every endpoint requires a valid token; missing or invalid → 401, produced by
  Member 1's middleware.
- Create, deactivate, activate, and the eligibility check → Backoffice only.
- Full list (C.3) → Backoffice or Grid Operator.
- Update → Backoffice for all fields; Grid Operator restricted to the operational
  subset, with a field-level check inside the service, because route-level role
  attributes cannot express "this role may change these three fields".
- Nearby, public detail, lookup → any authenticated role.
- Inactive stations are invisible to Prosumers — enforced in the service as a
  404, not by the client omitting them.

**Order of evaluation:** authorization → field validation → business validation.
Never leak the existence of a resource to a caller who fails authorization, and
never run a cross-module reservation query for a request that was going to fail
validation anyway.

---

## G. ROLE / SECURITY PLAN

### G.1 Permission matrix

| Operation | Backoffice | Grid Operator | Prosumer |
|---|---|---|---|
| Create station (C.1) | yes | no | no |
| Get by id, full (C.2) | yes | yes | public projection, Active only |
| List all (C.3) | yes | yes | no |
| Update — all fields (C.4) | yes | no | no |
| Update — operational subset (C.4) | yes | yes | no |
| Deactivate (C.5) | yes | no | no |
| Reactivate (C.6) | yes | no | no |
| Nearby / map (C.7) | yes | yes | yes |
| Public detail (C.8) | yes | yes | yes |
| Deactivation eligibility (C.9) | yes | no | no |
| Lookup (C.9) | yes | yes | yes |

Rationale to put in the report: Backoffice owns the station *asset* — it decides
what exists and whether it is in service. A Grid Operator runs a station
day-to-day — it can report slot availability and adjust hours, but should not be
able to take a node offline while prosumers are relying on it. Prosumers are
consumers of location data only.

### G.2 How your API consumes the authenticated role

You do not implement authentication. Member 1 issues a token containing at
minimum a user identifier claim and a role claim, and registers the
authentication and authorization middleware in the pipeline.

What your module does with it:

- Decorate controller actions with the framework's authorization attributes
  naming the required role(s); the pipeline rejects with 401/403 before your
  action runs.
- Inside the action, read the user id and role from the request's authenticated
  principal (the claims on `User`), never from a header, query parameter, or
  request body — a client-supplied role is a client-controlled role.
- Pass the user id down to the service as an explicit parameter so the service
  can stamp `createdByUserId` / `updatedByUserId` without depending on HTTP.
- For the field-level Grid Operator restriction and the Prosumer projection, the
  service receives the role as a parameter and branches on it, because these are
  business rules about data shape, not route-level access.

**Agree with Member 1 in writing:** the exact claim names, the exact role
strings (`Backoffice`, `GridOperator`, `Prosumer` — spelling and casing), and
the token lifetime. A mismatch in a role string is the single most common
integration failure in projects like this.

---

## H. ERROR HANDLING

### H.1 One error envelope for every failure

Every non-2xx response from your module returns the same JSON shape, so both
clients can write one error handler:

```
{
  "success": false,
  "errorCode": "<STABLE_MACHINE_READABLE_CODE>",
  "message": "<human-readable sentence>",
  "details": { ...optional structured context... },
  "traceId": "<request correlation id>",
  "timestamp": "<UTC ISO-8601>"
}
```

`errorCode` is what clients branch on; `message` is what humans read and may be
reworded freely; `details` carries whatever the specific failure needs. Include
`traceId` — when a demo fails you want to find the one log line that matters.

Implement it once as a global exception/result-mapping filter rather than
constructing envelopes in each action, so no endpoint can drift.

### H.2 Worked examples

**Invalid station data — 400**
```
errorCode: "VALIDATION_ERROR"
message:   "One or more fields are invalid."
details:   { "capacityKWh": ["Capacity must be greater than 0."],
             "name": ["Name must be at least 3 characters."] }
```
Field errors are returned as a map of field → messages so the web form can mark
the offending inputs, and *all* failures are returned at once rather than one
per round-trip.

**Station not found — 404**
```
errorCode: "STATION_NOT_FOUND"
message:   "No station exists with the specified identifier."
details:   { "stationId": "652f1a9c4e3b2a0d18c7f901" }
```

**Unauthorized operation — 403**
```
errorCode: "FORBIDDEN_OPERATION"
message:   "Your role is not permitted to perform this operation."
details:   { "requiredRole": "Backoffice" }
```
Do not echo the caller's own role back, and do not confirm whether the target
station exists.

**Station already inactive — 409**
```
errorCode: "STATION_ALREADY_INACTIVE"
message:   "This station is already inactive."
details:   { "currentStatus": "Inactive",
             "deactivatedAtUtc": "2026-09-18T09:30:00Z" }
```

**Active reservations prevent deactivation — 409**
```
errorCode: "STATION_HAS_ACTIVE_RESERVATIONS"
message:   "This station cannot be deactivated while 3 active reservations exist."
details:   { "stationId": "652f...901", "activeReservationCount": 3 }
```
The count is the important part — it turns an opaque refusal into an actionable
message, and it is the piece of evidence to screenshot for your report.

**Invalid coordinates — 400**
```
errorCode: "INVALID_COORDINATES"
message:   "Latitude must be between -90 and 90 and longitude between -180 and 180."
details:   { "latitude": 95.5, "longitude": 79.86 }
```
A distinct code from generic `VALIDATION_ERROR` because both the map picker and
the nearby endpoint want to handle it specially.

**Reservation module unavailable — 503**
```
errorCode: "RESERVATION_SERVICE_UNAVAILABLE"
message:   "Cannot verify reservations at this time. Please try again."
```
The fail-closed case from D.1 step 5.

### H.3 Rules

- Never return a raw exception message, stack trace, or Mongo driver error to a
  client — log the detail server-side, return a code.
- Map unexpected exceptions to a single 500 `INTERNAL_ERROR` with the traceId.
- Keep `errorCode` values stable; clients will branch on them.

---

## I. INTEGRATION CONTRACT WITH MEMBER 3

### I.1 What you need

Exactly one fact: **for a given station id, are there any active reservations,
and how many?**

You do not need reservation ids, user ids, time slots, energy amounts, or
statuses. Asking for less is what keeps the modules independent.

### I.2 The contract (conceptual)

An interface **you define in your module** (so your module owns its dependency
shape) and **Member 3 implements**:

- **Name:** `IReservationAvailabilityService`
- **Owner of the interface:** Member 2 (you) — placed in a shared/abstractions
  location.
- **Owner of the implementation:** Member 3.
- **Registration:** in DI at application startup, implementation bound to the
  interface.

**Operation 1 — count active reservations**
- Input: station id (string).
- Output: a non-negative integer count.
- Semantics: counts reservations for that station that are `Pending` or
  `Approved` and whose slot has not yet passed (the definition from D.2).
- Contract: never throws for "none found" — returns 0. Throws only on genuine
  failure.

**Operation 2 (optional, convenience) — boolean check**
- Input: station id.
- Output: `true` if any active reservation exists.
- Useful when you only need the guard and not the count; skip it if you always
  want the count for the error message.

**Operation 3 (optional, for the C.4 slot-reduction rule) — reserved slot count**
- Input: station id.
- Output: number of battery slots currently held by active reservations.
- Only needed if you enforce the "cannot shrink capacity below reserved" rule.

### I.3 Agreed properties

- **Direction:** one-way. Member 2 → Member 3 only. Member 3 must never call
  into your station service to decide reservation rules; if Member 3 needs
  station data they use your public read endpoints or the lookup endpoint.
- **Definition ownership:** "active" is defined and maintained by Member 3. If
  the definition changes, your code does not.
- **Failure behaviour:** on exception, your service fails closed (503, no
  deactivation).
- **Performance:** this is called on a rare operator action, not on a hot path —
  a straightforward count query is fine.
- **Development unblocking:** register a stub implementation returning 0 so you
  can build and test your module before Member 3's is ready, and write at least
  one test with a stub returning 3 to prove the block path works.

### I.4 What Member 3 needs from you in return

- The `GET /api/stations/lookup` endpoint for station dropdowns.
- A guarantee that a station id, once created, is stable.
- The rule that Member 3 should refuse to create a reservation against a station
  whose status is not `Active` — this closes the race window from D.4.

---

## J. INTEGRATION CONTRACT WITH MEMBER 4

Member 4 owns grid operations, QR verification, dashboards, and energy-transfer
finalization. You own station reference data. The boundary: **you provide facts
about stations; Member 4 provides facts about operations.** You compute no
dashboard metrics and you own no transfer state.

**What Member 4 consumes from you**

- *Dashboards:* station counts by status, and the identity/location/capacity of
  each station so totals can be attributed and mapped. Serve these through your
  existing read endpoints (C.3 with a status filter, C.9 lookup) — do not build
  a `/api/stations/stats` endpoint, because the moment aggregate numbers live in
  your module the ownership line blurs. If Member 4 needs a heavy aggregate,
  they aggregate over what your endpoints return, or they own the aggregation
  endpoint themselves.
- *Grid operations:* current `status`, `operationalSchedule` and derived
  `isOpenNow`, `capacityKWh`, `totalBatterySlots`, and `contactPhone` — enough
  to decide whether a node can accept work right now. Available via C.2.
- *QR / energy-transfer workflow:* the QR code a prosumer presents will encode a
  reservation reference and a station reference. Member 4 validates it by
  resolving the station id against your module and checking that the station
  exists and is `Active`. C.2 or C.8 is sufficient; no new endpoint is needed.
- *Slot bookkeeping:* if `availableBatterySlots` is stored rather than derived
  (the decision in section B), someone must decrement it when a transfer starts
  and restore it when it completes or is cancelled. The cleanest split: Member 4
  calls your update path (or a narrow internal service method you expose) at
  transfer start and finalization. **Agree explicitly on who writes this field
  and when** — an unowned mutable counter is the most likely source of an
  inconsistent demo.

**What you must not do:** compute energy-transfer totals, store transfer
records, generate or validate QR payloads, or hold dashboard state. If you find
yourself adding a field to `SolarStationInfo` that changes on every transfer
(beyond the slot counter above), it probably belongs in Member 4's collection.

---

## K. IMPLEMENTATION CHECKLIST

Work top to bottom; each step leaves the project in a runnable state.

1. **Agree the cross-module contracts first.** Role strings and claim names with
   Member 1; the `IReservationAvailabilityService` shape and the definition of
   "active" with Member 3; the `availableBatterySlots` ownership with Member 4.
   Write them down. Doing this before any code is what prevents a rewrite in
   week three.
2. **Create the project structure.** Folders for Models (entities), DTOs
   (request/response), Repositories (+ interfaces), Services (+ interfaces),
   Controllers, Configuration, and a shared Abstractions location for the
   reservation interface. Remove the WeatherForecast scaffold.
3. **Add the MongoDB driver package** and a strongly-typed settings class bound
   to a `MongoDbSettings` section in `appsettings.json` (connection string,
   database name, collection name). Keep real values in
   `appsettings.Development.json` and out of source control.
4. **Register Mongo in DI** — client as singleton, database resolved from it,
   repositories scoped.
5. **Define the station entity** mirroring section B, with the schedule entry as
   a nested type and status as an enum. Decide and apply your id representation
   (ObjectId stored, string exposed).
6. **Define DTOs** — create request, update request, deactivate request, full
   response, list-summary response, map-summary response, public-detail
   response. Keep entities out of controller signatures entirely.
7. **Create the repository interface**, then the implementation: create, get by
   id, get paged/filtered list, update, update status, exists-by-code, get
   active stations (for nearby).
8. **Create indexes** at startup or via a one-off script: unique `stationCode`,
   index on `status`, geospatial index if you chose that route.
9. **Build the service layer interface and implementation** for create, get,
   list, update, deactivate, activate, nearby, public detail, lookup,
   eligibility. Return a result type that names each failure reason rather than
   throwing for expected outcomes.
10. **Implement field validation** (section F.1) — one validation approach
    applied consistently, with all errors collected per request.
11. **Implement business validation** (section F.2) in the service, including
    uniqueness and the slot invariant.
12. **Define `IReservationAvailabilityService`** and register a stub returning 0
    so you are unblocked.
13. **Implement the controller endpoints** from section C, mapping service
    outcomes to status codes. No business logic in the controller.
14. **Implement the global error envelope** (section H) as a filter/middleware,
    and confirm every endpoint produces it.
15. **Apply authorization attributes** and read the user id/role from the
    principal; coordinate with Member 1's middleware registration order.
16. **Implement the nearby/distance logic** and the `isOpenNow` computation from
    the schedule (be explicit about time zone handling).
17. **Swap in Member 3's real implementation** of the reservation interface and
    re-run the deactivation tests.
18. **Test every endpoint** against the plan in section L using an HTTP client
    (the existing `.http` file or Postman); save a collection — it is your
    testing evidence.
19. **Seed realistic data** — a dozen stations with genuine coordinates spread
    across a real area, so the map demo looks like a system and not a fixture.
20. **Connect the web application** — station list, create/edit form with map
    picker, deactivate action, and correct rendering of the
    `STATION_HAS_ACTIVE_RESERVATIONS` error.
21. **Hand the mobile team the contract** (sections E and C.8) and support the
    map integration; verify markers and detail rendering against real responses.
22. **Deploy to IIS** — publish the app, create the site/app pool (No Managed
    Code, since ASP.NET Core runs out of process), install the ASP.NET Core
    Hosting Bundle, configure production settings, and confirm the Mongo
    connection works from the server. Re-run the Postman collection against the
    deployed URL, not just localhost.
23. **Capture evidence** — screenshots and test results per section N.

---

## L. TEST PLAN

Roles in the "Input" column indicate the token used. All endpoints assume a
valid token unless the test says otherwise.

### Creation

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-01 | Successful station creation | Backoffice; all required fields valid, unique code | Station persisted with server-set id and audit fields; full document returned | 201 |
| TC-02 | Missing required field | Backoffice; `name` omitted | `VALIDATION_ERROR` naming `name`; nothing persisted | 400 |
| TC-03 | Duplicate station code | Backoffice; `stationCode` already exists | `DUPLICATE_STATION_CODE`; nothing persisted | 409 |
| TC-04 | Duplicate code, different casing | Backoffice; existing `CMB-01`, submit `cmb-01` | Rejected — comparison is case-insensitive | 409 |
| TC-05 | Client supplies audit fields | Backoffice; body includes `createdAtUtc` and `createdByUserId` | Values ignored; server values used | 201 |

### Coordinate validation

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-06 | Latitude above range | `latitude: 95.5` | `INVALID_COORDINATES` | 400 |
| TC-07 | Longitude below range | `longitude: -190` | `INVALID_COORDINATES` | 400 |
| TC-08 | Boundary coordinates accepted | `latitude: 90`, `longitude: 180` | Created successfully | 201 |
| TC-09 | Non-numeric coordinate | `latitude: "abc"` | Validation error, not a 500 | 400 |
| TC-10 | Null-island coordinates | `latitude: 0`, `longitude: 0` | Rejected as unset coordinates | 400 |

### Capacity and slot validation

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-11 | Zero capacity | `capacityKWh: 0` | Validation error | 400 |
| TC-12 | Negative capacity | `capacityKWh: -50` | Validation error | 400 |
| TC-13 | Capacity above ceiling | `capacityKWh: 999999` | Validation error | 400 |
| TC-14 | Available exceeds total slots | `total: 10`, `available: 15` | Business validation error | 409 |
| TC-15 | Zero total slots | `totalBatterySlots: 0` | Validation error (minimum 1) | 400 |
| TC-16 | Available equals total | `total: 10`, `available: 10` | Accepted | 201 |

### Schedule validation

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-17 | Valid schedule | Mon–Fri 06:00–20:00 | Accepted and stored | 201 |
| TC-18 | Close before open | `open: 20:00`, `close: 06:00` | Validation error | 400 |
| TC-19 | Duplicate day entries | Two Monday entries | Business validation error | 409 |
| TC-20 | Malformed time | `open: "25:00"` | Validation error | 400 |

### Retrieval

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-21 | Get existing station by id | Backoffice; valid id | Full document with audit fields | 200 |
| TC-22 | Get non-existent station | Valid-format id, no such document | `STATION_NOT_FOUND` | 404 |
| TC-23 | Malformed id | `id: "123"` | Validation error, not a driver exception | 400 |
| TC-24 | List all with paging | Backoffice; `page=1&pageSize=5`, 12 stations seeded | 5 items; `totalCount=12`; `totalPages=3` | 200 |
| TC-25 | List filtered by status | `status=Inactive` | Only inactive stations | 200 |
| TC-26 | Search by name fragment | `search=Colombo` | Matching stations only | 200 |
| TC-27 | Invalid paging | `pageSize=500` | Validation error (max 100) | 400 |
| TC-28 | Invalid sort field | `sortBy=password` | Validation error — not silently ignored | 400 |

### Update

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-29 | Successful update | Backoffice; new name, capacity, coordinates | Fields changed; `updatedAtUtc`/`updatedByUserId` refreshed; `createdAtUtc` unchanged | 200 |
| TC-30 | Update non-existent station | Valid-format unknown id | `STATION_NOT_FOUND` | 404 |
| TC-31 | Attempt to change station code | Backoffice; different `stationCode` | Rejected as immutable | 409 |
| TC-32 | Update breaks slot invariant | `total: 5` while `available: 8` | Business validation error | 409 |
| TC-33 | Grid Operator updates allowed field | GridOperator; `availableBatterySlots` only | Accepted | 200 |
| TC-34 | Grid Operator updates restricted field | GridOperator; changes `capacityKWh` | `FORBIDDEN_OPERATION` | 403 |
| TC-35 | Update schedule only | Valid new schedule | Schedule replaced; other fields untouched | 200 |

### Deactivation and reactivation

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-36 | Deactivate with no active reservations | Backoffice; reservation stub returns 0 | Status `Inactive`; `deactivatedAtUtc` and reason set | 200 |
| TC-37 | Deactivate with active reservations | Backoffice; stub returns 3 | `STATION_HAS_ACTIVE_RESERVATIONS`; `details.activeReservationCount = 3`; status unchanged | 409 |
| TC-38 | Deactivate an already-inactive station | Backoffice; station already `Inactive` | `STATION_ALREADY_INACTIVE`; reservation service is **not** called | 409 |
| TC-39 | Deactivate non-existent station | Unknown id | `STATION_NOT_FOUND` | 404 |
| TC-40 | Reservation service throws | Stub configured to throw | `RESERVATION_SERVICE_UNAVAILABLE`; station remains `Active` (fails closed) | 503 |
| TC-41 | Only completed/cancelled reservations exist | Stub returns 0 for a station with completed bookings | Deactivation succeeds | 200 |
| TC-42 | Reactivate an inactive station | Backoffice | Status `Active`; `deactivatedAtUtc` and reason cleared | 200 |
| TC-43 | Reactivate an already-active station | Backoffice | `STATION_ALREADY_ACTIVE` | 409 |
| TC-44 | Eligibility check with reservations | Backoffice; stub returns 2 | `canDeactivate: false`, count 2; station unchanged | 200 |

### Authorization

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-45 | No token | Create request, no Authorization header | Unauthorized | 401 |
| TC-46 | Expired/invalid token | Create request, malformed token | Unauthorized | 401 |
| TC-47 | Prosumer attempts create | Prosumer token | `FORBIDDEN_OPERATION`; nothing persisted | 403 |
| TC-48 | Grid Operator attempts deactivate | GridOperator token | `FORBIDDEN_OPERATION` | 403 |
| TC-49 | Prosumer attempts full list | Prosumer token on C.3 | Forbidden | 403 |
| TC-50 | Role supplied in request body | Prosumer token, body claims `role: Backoffice` | Body ignored; forbidden | 403 |

### Inactive-station visibility

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-51 | Backoffice reads an inactive station | Backoffice; inactive id | Full document returned | 200 |
| TC-52 | Prosumer reads an inactive station | Prosumer; inactive id via C.8 | `STATION_NOT_FOUND` — existence not disclosed | 404 |
| TC-53 | Inactive station excluded from nearby | Station inside radius but `Inactive` | Absent from results | 200 |
| TC-54 | Inactive station excluded from lookup | C.9 lookup | Absent from results | 200 |

### Mobile / location

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-55 | Nearby returns stations in radius | Valid coords, `radiusKm=10`, 3 stations within | 3 map summaries, sorted by ascending `distanceKm` | 200 |
| TC-56 | Nearby excludes stations outside radius | Station 50 km away, `radiusKm=10` | Not returned | 200 |
| TC-57 | Nearby with no matches | Coordinates in an empty area | Empty array, **not** 404 | 200 |
| TC-58 | Nearby missing coordinates | `latitude` omitted | Validation error | 400 |
| TC-59 | Nearby invalid radius | `radiusKm=-5` | Validation error | 400 |
| TC-60 | Nearby radius above cap | `radiusKm=5000` | Validation error (max 100) | 400 |
| TC-61 | Nearby respects limit | `limit=2` with 10 stations in range | Exactly 2, the nearest two | 200 |
| TC-62 | Map summary payload shape | Any nearby call | Contains exactly the E.3 fields; no audit fields leaked | 200 |
| TC-63 | Public detail after marker tap | Valid active station id via C.8 | Public fields including schedule and `isOpenNow`; no audit fields | 200 |
| TC-64 | `isOpenNow` true during window | Current time inside Monday 06:00–20:00 | `isOpenNow: true` | 200 |
| TC-65 | `isOpenNow` false outside window | Current time outside all windows | `isOpenNow: false` | 200 |
| TC-66 | Station with no schedule | Schedule absent | Endpoint succeeds; `isOpenNow` is a documented default (decide: `true` or `null`) | 200 |

### Edge cases

| ID | Scenario | Input | Expected result | HTTP |
|---|---|---|---|---|
| TC-67 | Name at minimum length | 3 characters | Accepted | 201 |
| TC-68 | Name one below minimum | 2 characters | Validation error | 400 |
| TC-69 | Name at maximum length | 100 characters | Accepted | 201 |
| TC-70 | Whitespace-only name | `"   "` | Validation error after trimming | 400 |
| TC-71 | Leading/trailing whitespace | `"  Hub  "` | Stored trimmed as `"Hub"` | 201 |
| TC-72 | Unicode in name | Sinhala/Tamil characters | Stored and returned intact | 201 |
| TC-73 | Very long description | 501 characters | Validation error | 400 |
| TC-74 | Concurrent deactivation of the same station | Two simultaneous requests | One succeeds (200), the other gets `STATION_ALREADY_INACTIVE` (409) | 200 / 409 |
| TC-75 | Empty database list | No stations seeded | Empty `items`, `totalCount: 0` | 200 |
| TC-76 | Mongo unavailable | Database stopped | `INTERNAL_ERROR` envelope with traceId; no raw driver message | 500 |

---

## M. GIT / DEVELOPMENT PLAN

Work on a feature branch (`feature/member2-stations`) and merge to `develop` via
pull request, so your history is reviewable and you never break the shared
branch. One milestone per commit; each should build.

| # | Commit message | Contents |
|---|---|---|
| 1 | `chore: remove scaffold and add station module folder structure` | Delete WeatherForecast files; create Models/DTOs/Repositories/Services/Controllers/Configuration folders |
| 2 | `feat: add MongoDB configuration and connection setup` | Driver package, settings class, DI registration, appsettings section |
| 3 | `feat: add SolarStationInfo entity and station status enum` | Entity, nested schedule type, enum |
| 4 | `feat: add station request and response DTOs` | Create/update/deactivate requests; full, summary, map, and public-detail responses |
| 5 | `feat: add station repository interface and MongoDB implementation` | CRUD plus the specific queries; index creation |
| 6 | `feat: add station service with create and retrieval logic` | Service interface, create, get by id, list with paging/filtering |
| 7 | `feat: add field and business validation for station operations` | Validation rules from section F.1 and F.2 |
| 8 | `feat: add station controller with CRUD endpoints` | C.1–C.4 wired up |
| 9 | `feat: add standard API error response envelope and global handler` | Section H |
| 10 | `feat: define reservation availability contract and stub implementation` | `IReservationAvailabilityService` plus dev stub |
| 11 | `feat: add station deactivation with active reservation guard` | C.5, the full section D flow |
| 12 | `feat: add station reactivation and deactivation eligibility endpoints` | C.6 and the eligibility check |
| 13 | `feat: add nearby station search for mobile map` | C.7, distance logic, map summary DTO |
| 14 | `feat: add public station detail and lookup endpoints` | C.8 and C.9 lookup |
| 15 | `feat: add role-based authorization to station endpoints` | Attributes, principal claim reading, Grid Operator field restriction |
| 16 | `feat: compute station open status from operational schedule` | `isOpenNow` |
| 17 | `test: add unit and integration tests for station module` | Section L coverage |
| 18 | `chore: integrate Member 3 reservation availability implementation` | Swap the stub |
| 19 | `docs: add station API documentation and Postman collection` | Evidence artefacts |
| 20 | `chore: configure IIS deployment settings for station module` | Publish profile, production configuration |

Conventions: Conventional Commit prefixes (`feat`/`fix`/`chore`/`docs`/`test`),
imperative mood, one logical change per commit. Never commit
`appsettings.Development.json` with real credentials, `bin/`, `obj/`, or
`.vs/` — confirm the `.gitignore` covers these before your first push.

---

## N. REPORT CONTENT

What to document for your module. Write it yourself — this is the outline and
the emphasis, not the text.

**1. Architecture**
- A diagram of the three-tier flow with your module highlighted, and a second
  showing Controller → Service → Repository → MongoDB.
- A paragraph on *why* the layers are separated, using the reservation
  dependency as the concrete example — it is the strongest argument you have.
- Where your module sits relative to the other three, and the direction of every
  dependency arrow (note that Member 2 → Member 3 is one-way, and why).
- How IIS hosts the API and why clients never reach the database.

**2. Database design**
- The full `SolarStationInfo` field table from section B.
- A sample document.
- Justify: embedded schedule vs separate collection; stored vs derived
  `availableBatterySlots`; separate `_id` and `stationCode`; your coordinate
  storage choice.
- The indexes you created and the query each one serves.
- One paragraph on why NoSQL suits this data (a station is a self-contained
  document with a variable-length nested schedule and no join requirements).

**3. API design**
- A summary table: method, route, purpose, role, status codes.
- Full request/response examples for the three most interesting endpoints —
  create, deactivate (both success and the reservation-block rejection), and
  nearby.
- Your REST conventions: why `PATCH` for state transitions rather than `PUT`,
  why separate backoffice and public read endpoints, why 409 for rule conflicts.

**4. Validation and business rules**
- The three-tier table from section F, with the distinction between field,
  business, and authorization validation stated explicitly — this distinction is
  exactly what markers look for.
- The deactivation rule as a numbered flow or flowchart.
- Your definition of "active reservation" and a note that Member 3 owns it.
- The fail-closed decision on dependency failure, with the reasoning.

**5. Screenshots to capture**
- Station list in the web backoffice, showing active and inactive rows.
- Create station form, including the map location picker.
- A validation failure in the form (invalid coordinates is the most legible).
- Successful deactivation, with the confirmation.
- **The blocked deactivation showing the active-reservation message and count —
  this is your headline evidence for the business rule.**
- Postman: a successful create (201) with the response body.
- Postman: the 409 reservation-block response body.
- Postman: a nearby query with coordinates and the returned list.
- MongoDB Compass showing the `SolarStationInfo` collection and one expanded
  document.
- MongoDB Compass showing the indexes.
- Android map with multiple station markers.
- Android station detail after a marker tap.
- IIS Manager showing the deployed site and application pool.
- The API responding successfully at the IIS URL (not localhost).

**6. Testing evidence**
- The test-case table from section L with actual results and pass/fail.
- The exported Postman collection and a run summary.
- Unit test results for the service layer, especially the deactivation paths
  with stubbed reservation counts.
- Explicitly show both deactivation branches — it proves the rule works, rather
  than merely that the happy path works.

**7. Challenges**
Write honestly about what was actually hard. Likely candidates:
- Enforcing the deactivation rule without duplicating reservation logic, and
  arriving at the injected-interface solution.
- Deciding whether `availableBatterySlots` should be stored or derived, and the
  ownership question it raised with Member 4.
- Coordinating role strings and claim names with Member 1 (and what broke before
  you did).
- Being blocked by Member 3's module and solving it with a stub implementation.
- Choosing between service-layer and database-level geospatial search.
- Time zone handling for `isOpenNow`.
- IIS deployment specifics — the hosting bundle, the No Managed Code app pool,
  and configuration differing from localhost.

**8. Design decisions**
A table of *decision · alternatives considered · choice · rationale*. Include:
soft deactivation over deletion; separate activate/deactivate endpoints over a
generic status PUT; in-process interface over an HTTP call to Member 3; radius
search over returning all stations; distinct public and backoffice read
endpoints; failing closed when the reservation service is unavailable; a single
error envelope across all endpoints.

Marks in projects like this go to *justified* decisions far more than to
implemented features. Every table row above is a defensible choice — say what
you rejected and why.

---

## Quick reference — endpoint summary

| Method | Route | Purpose | Role |
|---|---|---|---|
| POST | `/api/stations` | Register station | Backoffice |
| GET | `/api/stations/{id}` | Full detail | Backoffice, GridOperator |
| GET | `/api/stations` | Paged management list | Backoffice, GridOperator |
| PUT | `/api/stations/{id}` | Update station | Backoffice (all), GridOperator (subset) |
| PATCH | `/api/stations/{id}/deactivate` | Deactivate, guarded | Backoffice |
| PATCH | `/api/stations/{id}/activate` | Reactivate | Backoffice |
| GET | `/api/stations/nearby` | Map marker feed | Any authenticated |
| GET | `/api/stations/{id}/details` | Public detail (marker tap) | Any authenticated |
| GET | `/api/stations/{id}/deactivation-eligibility` | Pre-check | Backoffice |
| GET | `/api/stations/lookup` | Id/code/name for other modules | Any authenticated |
