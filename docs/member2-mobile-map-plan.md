# Member 2 — Mobile Map & Location Services

## Implementation Plan (planning only — no source code)

**Scope:** Integrate the Google Maps API to plot nearby grid nodes and display
station details from their stored latitude and longitude.

**Marks this targets:** 8 of the 65 individual marks.

| Criterion | Component | Marks |
|---|---|---|
| Grid Operator Verification and Map Features (7) | Show nearby stations on the map | **5** |
| Service Integration, Local Persistence and Device Capabilities (12) | Google Maps API integration | **3** |

What "Excellent" requires, in the marking scheme's own words: *"Nearby grid
nodes are plotted on the map from their stored latitude and longitude, with
station details on selection"* and *"Google Maps is integrated."* Both halves
matter — a map that renders but shows hard-coded pins scores 2–3, not 5.

---

## 0. Before you start

### 0.1 Install Android Studio

You have Java 21 but **no Android SDK and no Android Studio**. The scaffold
already expects the Android Gradle Plugin toolchain, so install Android Studio
from [developer.android.com/studio](https://developer.android.com/studio) — it
bundles the SDK, the emulator and an embedded JDK.

Kotlin is fine for the "pure native Android, no frameworks" rule: it is Google's
default Android language and compiles to the same native app as Java. The rule
targets React Native, Flutter, Xamarin and Ionic. Your scaffold is already
Kotlin.

VS Code is technically possible but costs you the emulator manager, the layout
editor and the debugger. Not worth it for this.

### 0.2 What already exists

`mobile-client/` is scaffolded and ready:

- AGP 8.9.1, Kotlin 2.0.21, minSdk 24, compileSdk 36
- XML layouts, not Compose (stay with XML — it is simpler to explain at a viva)
- A Gradle version catalog at `gradle/libs.versions.toml`
- Empty package folders including `ui/map/`, `data/remote/`, `data/model/`

Nothing for networking, Maps or permissions yet. That is what this plan adds.

### 0.3 Where your boundary sits

| Belongs to you | Belongs to another member |
|---|---|
| The map screen and its markers | Login and role routing |
| Station detail on marker tap | SQLite local persistence |
| Google Maps setup and the API key | QR scanning and verification |
| Calling `/api/stations/nearby` | Reservations, bookings, dashboards |

The HTTP client (Retrofit/OkHttp) is shared infrastructure. Agree with your
group who builds it. If you build it first because the map is the first
API-backed screen, say so in your individual contribution — it is 2 further
marks under "Mobile app to Web API."

---

## A. What you are building

One screen, two states:

```
┌─────────────────────────────────┐
│  ← Nearby Grid Nodes      ⟳     │   toolbar
├─────────────────────────────────┤
│                                 │
│      📍Fort      📍Borella       │   Google Map
│           📍Rajagiriya           │   markers from the API
│      📍Dehiwala   📍Nugegoda     │
│              ⊙ you              │
│                                 │
├─────────────────────────────────┤
│ ▲ Colombo Fort Exchange Hub     │   bottom sheet,
│   CMB-FORT-02 · 2.4 km · Open   │   appears on marker tap
│   420 kWh · 12 of 30 slots free │
│   Olcott Mawatha, Colombo 11    │
│   [ Directions ]                │
└─────────────────────────────────┘
```

The backend endpoint you already built returns exactly what this needs. One
call, one list, no extra round trips to draw the map.

---

## B. The API you are consuming

Your own Member 2 backend. Both endpoints are built, running and tested.

### B.1 Marker feed

```
GET /api/stations/nearby?latitude=&longitude=&radiusKm=&limit=
```

| Parameter | Required | Default | Limit |
|---|---|---|---|
| `latitude` | yes | — | −90 … 90 |
| `longitude` | yes | — | −180 … 180 |
| `radiusKm` | no | 10 | > 0, max 100 |
| `limit` | no | 50 | 1 … 200 |

Returns an array sorted by ascending distance. Each element:

| Field | Type | Use on the map |
|---|---|---|
| `id` | string | Key for the detail lookup on tap |
| `stationCode` | string | Shown in the info window |
| `name` | string | Marker title |
| `latitude` | double | Marker position |
| `longitude` | double | Marker position |
| `capacityKWh` | double | Detail line |
| `availableBatterySlots` | int | The number a prosumer actually cares about |
| `distanceKm` | double | "2.4 km away", already computed server-side |
| `isOpenNow` | bool | Open/closed chip — computed server-side, so the phone never parses time windows |

Two behaviours to rely on rather than re-implement:

- **Only Active stations are returned.** Inactive and Maintenance nodes are
  filtered out by the API. Do not filter client-side; there is nothing to filter.
- **An empty array is a valid answer**, meaning "nothing near you" — it is a
  200, not a 404. Render an empty state, not an error.

### B.2 Station detail on selection

```
GET /api/stations/{id}/details
```

Returns the public projection: everything in the map summary plus `description`,
`addressLine`, `totalBatterySlots`, `operationalSchedule[]` and `contactPhone`.
No audit fields.

**Design decision to make and defend.** The marker feed already carries enough
for a useful bottom sheet. You have two options:

1. **Show the summary immediately, fetch detail only if the user expands.**
   Instant response on tap, one extra call only when wanted.
2. **Always call `/details` on tap.** Simpler code, but a visible spinner on
   every tap.

Option 1 is the better experience and the better viva answer — it shows you
understood why the API has two shapes. Say so in your report.

### B.3 Authentication

Every endpoint needs an authenticated caller. Member 1 owns the token. Until it
exists, the backend's development handler accepts two headers:

```
X-Debug-Role: Prosumer
X-Debug-UserId: prosumer-042
```

Build your HTTP layer with a single interceptor that attaches identity, so
swapping to `Authorization: Bearer <token>` later is a one-line change.

---

## C. Architecture

Keep the same layering as the backend — it is easy to explain and it is what the
"clients are UI only" constraint requires.

```
MapActivity / MapFragment      ← Google Map, markers, bottom sheet
        ↓  observes
MapViewModel                   ← holds state, survives rotation
        ↓  calls
StationRepository              ← the only thing that knows about HTTP
        ↓  uses
StationApiService (Retrofit)   ← declares the endpoints
        ↓
   your C# Web API
```

**Why a ViewModel matters here.** Rotating the phone destroys and recreates the
Activity. Without a ViewModel your marker list is lost and the app re-fetches on
every rotation — which a marker will notice. The ViewModel survives the
configuration change, so state is kept and no call is repeated.

**What must not happen.** No business logic on the phone. Do not compute
distances (the API sends `distanceKm`), do not decide open/closed (the API sends
`isOpenNow`), do not filter by status (the API only returns Active). The brief
is explicit that logic lives in the API — and each of these is a place where
duplicating it would also let the two disagree.

---

## D. Dependencies to add

All are standard Android libraries — none is a cross-platform framework.

| Library | Why |
|---|---|
| `play-services-maps` | The Google Maps SDK. This is the requirement. |
| `play-services-location` | Fused location provider, for "where am I" |
| `retrofit` + `converter-gson` | HTTP client and JSON parsing |
| `okhttp` `logging-interceptor` | See the requests in Logcat while debugging |
| `lifecycle-viewmodel-ktx` | ViewModel |
| `kotlinx-coroutines-android` | Async calls without blocking the UI thread |
| `material` | Already present — supplies the bottom sheet |

Add each to `gradle/libs.versions.toml` and reference it from
`app/build.gradle.kts` with `libs.` — match the pattern already in that file
rather than hard-coding versions.

---

## E. Google Maps API key

This is the part most likely to cost you time, so do it first and confirm a map
renders before writing anything else.

### E.1 Getting a key

1. [Google Cloud Console](https://console.cloud.google.com) → create a project.
2. Enable **Maps SDK for Android**.
3. Credentials → Create credentials → API key.
4. **Restrict the key**: Application restrictions → Android apps; add your
   package name (`com.example.smartsolarmicrogrid`) and your debug SHA-1
   fingerprint. API restrictions → Maps SDK for Android only.

Get the debug SHA-1 from Gradle:

```
./gradlew signingReport
```

A free-tier key is sufficient; the Maps SDK for Android has no per-load charge.

### E.2 Keeping the key out of git

**Do not put the key in `AndroidManifest.xml` or commit it.** A key in a public
repo gets scraped within hours.

Put it in `local.properties` (already git-ignored by the Android template), read
it in `build.gradle.kts`, and expose it as a manifest placeholder the manifest
substitutes at build time. Document the setup step in your README so a marker
can supply their own key.

Mention this in your report — key handling is a genuine design decision and
shows security awareness.

### E.3 Verify before continuing

Render a map centred on Colombo with one hard-coded marker and run it. If the
map tiles are grey, the key or the SHA-1 restriction is wrong. Fixing that with
one marker on screen is far easier than with the whole feature half-written.

---

## F. Permissions

| Permission | Why | When |
|---|---|---|
| `INTERNET` | Reach your API and load map tiles | Manifest only |
| `ACCESS_FINE_LOCATION` | Precise "stations near me" | Runtime request |
| `ACCESS_COARSE_LOCATION` | Acceptable fallback | Runtime request |

Since Android 6.0 location must be **requested at runtime**, not just declared.
minSdk is 24, so this always applies.

Use `ActivityResultContracts.RequestMultiplePermissions`. Handle all three
outcomes:

| Outcome | Behaviour |
|---|---|
| Fine granted | Fetch exact position, query nearby |
| Coarse only | Use it — accurate enough for a 10 km radius |
| Denied | **Do not show an empty screen.** Fall back to a default centre (Colombo, 6.9271 / 79.8612), fetch stations around it, and show a "Enable location for stations near you" prompt |

That fallback is worth building. A denied permission is a normal state, and an
app that shows nothing is indistinguishable from an app that is broken.

---

## G. Build order

Each step leaves something you can run and see. Do not skip ahead — step 2 is
the one that fails, and it fails much more cheaply on its own.

1. **Install Android Studio**, open `mobile-client`, let it sync, run the
   scaffold on an emulator. Confirm the blank app launches.
2. **Get the Maps key working.** Add the dependency, wire the key through
   `local.properties`, show a map centred on Colombo with one hard-coded marker.
   *Stop until tiles render.*
3. **Add permissions and location.** Request at runtime, get the device
   position, move the camera there. Test the denied path too.
4. **Add the HTTP layer.** Retrofit interface, data classes matching section B,
   identity interceptor. Log a raw response to confirm the shape.
5. **Add the repository and ViewModel.** Expose loading / success / empty /
   error as explicit states rather than scattered booleans.
6. **Replace the hard-coded marker with real data.** This is the 5-mark
   requirement — markers from stored latitude and longitude.
7. **Add marker tap → bottom sheet.** Name, code, distance, slots, open state.
   This is *"station details on selection."*
8. **Handle every state.** Loading spinner, empty ("no stations within 10 km"),
   network failure with retry, permission denied.
9. **Polish.** Custom marker icon, a "recentre" button, maybe a radius chip.
10. **Capture evidence** (section J).

### On the emulator and your backend

The emulator cannot reach `localhost:5127` — that is the emulator's own
loopback. Use **`10.0.2.2:5127`**, which the Android emulator maps to the host
machine. On a physical device, use your PC's LAN IP and make sure both are on
the same network.

Also: Android blocks plaintext HTTP by default since API 28. For a local HTTP
backend you need a network security config permitting cleartext **for your dev
host only** — not a blanket `usesCleartextTraffic="true"`. Worth a sentence in
the report.

---

## H. Error and empty states

The API returns one error envelope everywhere, so handle it in one place.

| Situation | What the user sees |
|---|---|
| Loading | Spinner over the map |
| No stations in range | "No grid nodes within 10 km" + a widen-radius action |
| No network | "Cannot reach the server" + Retry |
| 401 | "Please sign in again" — hand off to Member 1's login |
| Permission denied | Default centre + "Enable location" prompt |
| Maps key invalid | Grey tiles — a build problem, not a runtime one; catch it in step 2 |

A marker will press exactly these paths, and "handle responses and errors
gracefully" is named in the marking scheme.

---

## I. Test plan

Manual, since this is UI work. Record results in your report.

| ID | Scenario | Expected |
|---|---|---|
| M-01 | Launch with location granted | Map centres on device, nearby markers appear |
| M-02 | Launch with location denied | Centres on Colombo, still shows stations, prompt visible |
| M-03 | Marker count matches API | Same count as the raw `/nearby` response |
| M-04 | Marker positions correct | Pins match seeded coordinates |
| M-05 | Tap a marker | Bottom sheet with that station's details |
| M-06 | Tap a second marker | Sheet updates; no stale data |
| M-07 | Inactive station absent | Wellawatte (Inactive) never appears |
| M-08 | Maintenance station absent | Negombo (Maintenance) never appears |
| M-09 | Empty area | Empty state, not an error |
| M-10 | Backend stopped | Error message with a working Retry |
| M-11 | Rotate the device | Markers survive; no refetch |
| M-12 | Distance sanity | Fort → Borella shows ≈ 4.4 km |
| M-13 | Open/closed correct | `isOpenNow` matches the station's schedule |
| M-14 | Airplane mode mid-session | Graceful failure, no crash |

M-07 and M-08 are the interesting ones: they prove the *server* is filtering, not
the phone. Your seeded data already has one station in each state.

---

## J. Evidence to capture

- Map with multiple markers across Colombo
- Bottom sheet open, showing station details after a tap
- The runtime permission dialog
- The permission-denied fallback state
- Empty state (query an area with nothing in it)
- Error state with the backend stopped
- Logcat or Postman showing the `/nearby` response beside the map — this is what
  demonstrates markers come from the API rather than being hard-coded
- `google_maps_api` setup documented in the README, key not in git

---

## K. Git milestones

| # | Commit |
|---|---|
| 1 | `chore: add maps, location, retrofit and lifecycle dependencies` |
| 2 | `feat: add google maps sdk setup with api key from local.properties` |
| 3 | `feat: add location permission handling with default-centre fallback` |
| 4 | `feat: add retrofit service and station data models` |
| 5 | `feat: add station repository and map view model` |
| 6 | `feat: plot nearby stations as map markers from the api` |
| 7 | `feat: show station details in a bottom sheet on marker selection` |
| 8 | `feat: handle loading, empty and error states on the map screen` |
| 9 | `style: custom marker icon and recentre control` |
| 10 | `docs: document google maps api key setup in readme` |

Descriptive commits are named in the brief as assessed evidence. Commit as you
go, not all at the end — the history should show the feature being built.

---

## L. For the viva

Be ready to answer, in your own words:

- **Why does the API send `distanceKm` and `isOpenNow` instead of the app
  computing them?** Because business logic belongs in the API (the FAT service
  pattern the brief requires), and because a phone computing open/closed would
  need the station's time zone and could disagree with the server.
- **How do you know inactive stations aren't shown?** The `/nearby` endpoint
  filters by status server-side. Demonstrate with the seeded Inactive station.
- **Why a ViewModel?** It survives rotation, so markers are not lost and the
  call is not repeated.
- **Where is the API key and why?** `local.properties`, injected at build time,
  never committed — a key in a public repo is scraped within hours.
- **Why `10.0.2.2` and not `localhost`?** `localhost` on the emulator is the
  emulator itself; `10.0.2.2` is the host machine.
- **What happens when location is denied?** Default centre, stations still load,
  prompt shown — a denied permission is a normal state, not a failure.

---

## A note on the assessment rules

Your brief sets this at **AI Assessment Scale Level 2 — AI Planning**: AI tools
are permitted for planning, brainstorming and preliminary research, but the
implementation "must be completed independently without AI assistance."

This document is a plan, which is what Level 2 allows. The code is yours to
write.

Two things follow. Your individual contribution section must **disclose the AI
tools used during planning** — no marks are awarded for the disclosure, so it
costs you nothing, but omitting it is a risk. And at the viva you will be asked
to explain and justify your decisions; anything you cannot explain or modify may
receive reduced or zero marks. Writing this yourself from the plan is what makes
that viva straightforward.

The same applies to the backend and web client already in this repository. Treat
them as reference implementations, rewrite them in your own hand, and make sure
you can explain every decision in them.
