# Smart Solar Microgrid Trading System

An end-to-end client-server system for managing a solar microgrid: Backoffice
staff register and schedule solar charging stations, Grid Operators monitor
battery slots and reservations, and solar prosumers book, manage and track
energy slots from a native Android app.

Built for **SE4040 — Enterprise Application Development** (Assignment 1) as a
group project of four members.

- **Git repository:** https://github.com/jeyixel/SmartSolarMicrogrid
- **Video walkthrough:** _add your YouTube/OneDrive link here_

## Architecture

A single C# Web API is the only thing that talks to the database. Both
clients are UI-only: they call the API over REST and hold no business logic
or direct database access of their own (FAT-service pattern).

```
┌─────────────────┐        REST / JWT        ┌──────────────────────┐        ┌─────────────┐
│  Web client      │ ───────────────────────▶ │                      │        │             │
│  (React + Vite)   │ ◀─────────────────────── │   backend-service     │ ─────▶ │   MongoDB   │
│  Backoffice /      │                        │   (ASP.NET Core 10)   │        │   (NoSQL)    │
│  Grid Operator     │                        │                      │        │             │
└─────────────────┘                        └──────────────────────┘        └─────────────┘
         ▲                                            ▲
         │                        REST / JWT          │
         │                                            │
┌─────────────────┐                                    │
│  mobile-client    │ ──────────────────────────────────┘
│  (pure Android,   │
│   Kotlin, SQLite   │
│   for local data)  │
│  Prosumer /        │
│  Grid Operator     │
└─────────────────┘
```

| Layer | Tech | Role |
|---|---|---|
| **backend-service** | ASP.NET Core 10 Web API, MongoDB.Driver, JWT Bearer auth | All business logic, validation and persistence |
| **web-client** | React 19, TypeScript, Vite, Tailwind CSS | UI for Backoffice (user & station management, all reservations) and Grid Operator (stations, schedules, slots, reservations) |
| **mobile-client** | Pure native Android, Kotlin, SQLite (local only) | UI for Prosumers (register, reserve slots, QR pass, booking history) and Grid Operators (on-site operations) |
| **Database** | MongoDB (Atlas or local) | `UserDetails`, `SolarStationInfo`, `EnergyBookingSlots`, `EnergyReservation` collections |

## Project structure

```
SmartSolarMicrogrid/
├── backend-service/     ASP.NET Core 10 Web API
│   ├── Controllers/      REST endpoints
│   ├── Services/         Business logic (FAT-service layer)
│   ├── Repositories/      MongoDB data access
│   ├── Models/           Database document shapes
│   ├── DTOs/              Request/response contracts
│   └── Infrastructure/     Middleware, indexes, error handling
├── web-client/          React + Vite web application
│   └── src/
│       ├── pages/         Route-level screens, by feature area
│       ├── components/     Shared and feature components
│       ├── api/           Typed REST client
│       └── contexts/       Auth/session state
├── mobile-client/        Pure native Android app
│   └── app/src/main/java/com/example/smartsolarmicrogrid/
│       ├── ui/            Activities, by feature area
│       ├── data/remote/    Retrofit-free REST client + DTOs
│       ├── data/local/     SQLite helpers (session, local cache)
│       └── data/repository/ Thin data-access layer over the API
└── docs/                 Design notes and the assignment report
```

## Roles

| Role | Web access | Mobile access | Responsibilities |
|---|---|---|---|
| **Backoffice** | ✅ | — | Register/deactivate prosumer accounts, create staff accounts, register and schedule solar stations, deactivate stations |
| **Grid Operator** | ✅ | ✅ | Monitor stations and reservations, update battery slot availability, verify QR codes on-site |
| **Prosumer** | — | ✅ | Register (NIC as primary key), reserve/modify/cancel energy slots, view booking history, present QR pass |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) and npm
- [Android Studio](https://developer.android.com/studio) (Ladybug or newer) with an emulator or a physical device
- A MongoDB connection string — either [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier) or a local `mongod`
- A [Google Maps API key](https://console.cloud.google.com/) with **Maps SDK for Android** enabled, for the mobile map screens

## Getting started

### 1. Backend (`backend-service`)

```bash
cd backend-service
dotnet restore
```

Create `backend-service/appsettings.Development.json` (gitignored, never
committed) with your own MongoDB connection string and a JWT secret:

```json
{
  "ConnectionStrings": {
    "MongoDb": "<your MongoDB connection string>"
  },
  "JwtSettings": {
    "SecretKey": "<a long random string, 32+ characters>"
  },
  "BootstrapAdmin": {
    "Enabled": true,
    "Email": "admin@smartsolar.local",
    "NIC": "200012345678",
    "PhoneNumber": "0771234567",
    "FullName": "Development Administrator",
    "Password": "<pick a password that meets the registration rules>"
  }
}
```

> **`appsettings.json` is committed as a template and must never hold a real
> connection string, password or JWT secret.** Real values belong only in
> `appsettings.Development.json`, `appsettings.Local.json` or environment
> variables — all of which are gitignored. See **Security notes** below.

Run it:

```bash
dotnet run
```

The API listens on `http://localhost:5127` by default (see
`Properties/launchSettings.json`) and serves Swagger UI at `/swagger` in
Development. On first run with `BootstrapAdmin.Enabled: true`, it seeds one
Backoffice administrator account — sign in with that account to create
further staff (Backoffice / Grid Operator) users from the web app.

### 2. Web client (`web-client`)

```bash
cd web-client
npm install
cp .env.example .env    # already points at http://localhost:5127 by default
npm run dev
```

Open `http://localhost:3000` (or the port Vite reports) and sign in with the
bootstrap administrator account created above.

### 3. Mobile client (`mobile-client`)

1. Open the `mobile-client` folder in Android Studio and let it sync Gradle.
2. Create `mobile-client/local.properties` (gitignored) alongside the
   auto-generated `sdk.dir` line:

   ```properties
   MAPS_API_KEY=<your Google Maps API key>
   API_BASE_URL=http://10.0.2.2:5127/
   ```

   - **Android emulator:** use `http://10.0.2.2:5127/` — the emulator's alias
     for your PC's `localhost`.
   - **Physical phone on the same Wi-Fi:** use `http://<your PC's LAN IP>:5127/`
     (find it with `ipconfig`), and allow inbound traffic to port 5127 in
     Windows Firewall.
3. Run the `app` configuration on an emulator or device.
4. Register a new Prosumer account from the app, or sign in with a Grid
   Operator account created from the web client.

## Business rules enforced by the API

- **Energy slot reservations** must be scheduled within the next **7 days**.
- **Updating or cancelling** a reservation requires at least **12 hours'**
  notice before the slot start time.
- **Deactivating a station** is blocked while it has active reservations.
- **Deactivating a prosumer account** can only be reversed by a Backoffice
  officer.
- Every rule above is enforced in `backend-service`, not in either client —
  both clients are UI-only and re-validate locally only as a convenience.

## Security notes

- **Never commit real secrets.** `appsettings.json` is a template; real
  connection strings, JWT secrets and bootstrap-admin passwords belong only
  in `appsettings.Development.json` / `appsettings.Local.json` / environment
  variables, all of which `.gitignore` excludes.
- **If a secret is ever committed by mistake, rotating it is not optional
  even after removing it from the file** — anyone who cloned the repo in the
  meantime still has the old value, and a public GitHub repo is typically
  indexed within minutes. Rotate the credential first, then clean the file.
- `mobile-client/local.properties` (Maps API key, backend URL) is
  machine-specific and gitignored; each developer creates their own copy.

## Individual contributions

| Member | Component | Area |
|---|---|---|
| Member 1 | User Identity & Account Management | Login, registration, JWT auth, profile management, Backoffice user administration |
| Member 2 | Microgrid Node Management | Station CRUD, GPS location, operating schedules, nearby-station search, Google Maps integration |
| Member 3 | Energy Booking Slots & Reservations | Slot management, reservation creation/update/cancellation, 7-day and 12-hour rules |
| Member 4 | Grid Operations, QR & Dashboards | QR code generation/verification, booking history, dashboard statistics |

_Replace the placeholders above with full names, IT numbers, and a more
detailed breakdown per the assignment's reporting requirements._

## AI usage disclosure

This assignment is set at **AI Assessment Scale Level 2 — AI Planning**: AI
tools may only be used for brainstorming, outlining and preliminary research,
not for implementation. Each member must disclose their own AI usage and
reflection in the report's individual contribution section.

_Add each member's disclosure here, or reference the report section where it
appears._
