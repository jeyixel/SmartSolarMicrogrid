# Member 2 — Implementation Notes

Companion to [member2-station-module-plan.md](member2-station-module-plan.md).
The plan says what to build and why; this records what was actually built, the
places the code sharpens the plan, and what remains to be done.

---

## File map

```
backend-service/
├── Abstractions/
│   ├── ApplicationRoles.cs                     role strings shared with Member 1
│   ├── IReservationAvailabilityService.cs      contract Member 3 implements
│   └── StubReservationAvailabilityService.cs   dev-only stand-in (delete later)
├── Configuration/
│   └── MongoDbSettings.cs
├── Controllers/
│   └── StationsController.cs                   all ten endpoints
├── Dtos/
│   ├── CreateStationRequest.cs
│   ├── UpdateStationRequest.cs
│   ├── ScheduleEntryDto.cs
│   ├── StationQueryParameters.cs               list + nearby query strings
│   └── StationResponses.cs                     all response shapes
├── Infrastructure/
│   ├── ApiErrorResponse.cs                     envelope + ErrorCodes
│   ├── ServiceResult.cs                        outcome type, ServiceError enum
│   ├── ServiceResultExtensions.cs              the one ServiceError → HTTP map
│   ├── ValidationProblemFactory.cs             model-binding failures → envelope
│   ├── ExceptionHandlingMiddleware.cs          last-resort 500 handler
│   ├── MongoIndexInitializer.cs                index creation at startup
│   └── DevelopmentAuthenticationHandler.cs     dev-only header auth (delete later)
├── Models/
│   ├── SolarStationInfo.cs                     the entity
│   ├── OperationalScheduleEntry.cs             embedded schedule entry
│   └── StationStatus.cs
├── Repositories/
│   ├── IStationRepository.cs
│   └── StationRepository.cs
├── Services/
│   ├── IStationService.cs
│   ├── StationService.cs                       all business logic
│   ├── StationMapper.cs                        entity → DTO projections
│   ├── ScheduleEvaluator.cs                    isOpenNow
│   └── GeoCalculator.cs                        Haversine + bounding box
├── seed-stations.js                            12 stations around Colombo
└── backend-service.http                        request-per-test-case file
```

---

## Where the code sharpens the plan

**Deactivation uses a compare-and-swap, not a plain write.**
`TryChangeStatusAsync` filters on the status that was just read, so the update
matches nothing if another request changed it first. The plan's section D.4
acknowledged the race and said to document it; the conditional filter closes the
half of it that lives in this module, and TC-74 now passes for the right reason.
The remaining window — a reservation created between the check and the write —
still depends on Member 3 refusing bookings against a non-Active station.

**Duplicate station codes are caught twice.**
The service checks before inserting, and a unique index catches anything that
slips through concurrently. The insert path translates the driver's duplicate-key
error into the same `DUPLICATE_STATION_CODE` envelope, so a race and an ordinary
duplicate look identical to the client.

**`GetByIdAsync` no longer takes an `isStaff` flag.**
The plan had one endpoint role-shaping its response. In the code the controller
routes a non-staff caller to `GetPublicDetailAsync` instead, so the service
method has one audience and no unused branch. Same external behaviour, one less
thing to keep in step.

**The nearby search pre-filters with a bounding box.**
The plan offered a choice between filtering in C# and a `2dsphere` index. The
code does neither purely: it narrows in the database with a latitude/longitude
box (served by `ix_status_lat_lon`), then applies the exact Haversine test in
memory. That keeps the contract identical to the geospatial version while
avoiding GeoJSON storage, and it is a straightforward migration later.

> **Worth writing up as a challenge.** The first version of the box widened
> longitude using the cosine at the *query* latitude. That is the standard
> formulation and it is wrong: points within the radius can lie closer to a pole,
> where a degree of longitude is shorter, so the box excluded real matches. A
> randomised check over 400,000 cases found 46 misses, all above 87° latitude.
> Widening at the box's extreme latitude, and using `asin(sin(r/R)/cos φ)`
> rather than the flat `r/R/cos φ`, gives zero misses over 2,000,000 cases
> including the poles. It never would have shown up in Colombo test data — a good
> illustration of why a property-based check beats a handful of examples.

**`isOpenNow` resolves one configured time zone.**
`Stations:TimeZoneId`, defaulting to `Sri Lanka Standard Time`. Schedules are
station-local, and storing a time zone per station would be the honest answer for
a multi-region deployment — noted in the code as the thing to change if that ever
happens. A station with no schedule is treated as open: an operator who has not
entered hours has not declared the station shut.

**Two stand-ins exist, both Development-only and both loud.**
`StubReservationAvailabilityService` returns 0 and logs a warning on every call.
`DevelopmentAuthenticationHandler` reads `X-Debug-Role` and `X-Debug-UserId`
headers. Neither is registered outside Development, so a misconfigured
production deployment fails closed rather than silently accepting any role or
skipping the reservation guard. Both are marked for deletion.

---

## Running it

1. **Restore and build.** The project targets .NET 10 and now references
   `MongoDB.Driver` 3.12.0.
2. **Connection string.** Already present in `appsettings.Development.json` under
   `ConnectionStrings:MongoDb`. That file is git-ignored.
3. **Seed data.** `mongosh "<connection string>" seed-stations.js` — twelve
   stations around Colombo, including one Inactive and one Maintenance so the
   status filters have something to show.
4. **Exercise the API.** Open `backend-service.http`; requests are labelled with
   the test-case ids from section L of the plan. Set `@stationId` from the
   create response before running the single-station calls.

Identity in development comes from headers, not a token:

```
X-Debug-Role: Backoffice        (or GridOperator, or Prosumer)
X-Debug-UserId: backoffice-001  (optional; lands in the audit fields)
```

Omitting `X-Debug-Role` produces a 401, matching how a missing token will behave
once Member 1's scheme is registered.

---

## Still to do

- [ ] **Build it.** The .NET SDK was not available on this machine, so the code
      has not been compiled. Expect to fix small things on the first build.
- [ ] **Swap in Member 1's authentication.** Delete
      `DevelopmentAuthenticationHandler` and its registration block in
      `Program.cs`. Confirm the role strings in `ApplicationRoles` match their
      issuer exactly, and that their claim for the user id is one of
      `NameIdentifier`, `sub` or `userId` — those are what `GetUserId()` reads.
- [ ] **Swap in Member 3's reservation implementation.** Delete
      `StubReservationAvailabilityService` and register theirs against
      `IReservationAvailabilityService`. Then re-run TC-36 through TC-41, which
      are the tests that actually prove the business rule.
- [ ] **Agree who writes `availableBatterySlots`** with Member 4 (section J of
      the plan). It is currently only ever set through the station endpoints.
- [ ] **Write the unit tests** from section L. The service takes all three of its
      collaborators as interfaces, so a stub returning 3 from
      `GetActiveReservationCountAsync` is enough to test the block path without a
      database.
- [ ] **Set `Cors:AllowedOrigins`** before deploying. With the list empty, any
      origin is allowed (without credentials), which is fine locally and not
      fine on IIS.
- [ ] **Rotate the MongoDB credentials.** The connection string in
      `appsettings.Development.json` contains a live username and password for an
      Atlas cluster. The file is git-ignored, so it is not in the repository —
      but if it was ever committed before that rule existed, or shared in a
      chat or a screenshot, treat the password as public and rotate it in Atlas.
