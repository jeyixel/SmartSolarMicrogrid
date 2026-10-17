# Backend business-rule tests

Five isolated xUnit tests exercise StationService.DeactivateAsync using mocked
repositories and reservation availability. They do not access Atlas, deploy to
IIS, or check the application's Production dependency registrations.

| Case | Expected outcome |
| --- | --- |
| Invalid station ID | Validation error before any database call |
| Missing station | NotFound without checking reservations |
| Two active reservations | HasActiveReservations; station remains active |
| Reservation service times out | ReservationServiceUnavailable; station remains active |
| No active reservations | Station becomes inactive; reason and operator are recorded |

The initial run on 2026-10-17 tested an isolated archive of local branch
`demo/cicd`, commit `51c59222f6c074fe36c98c0299386b1eb9eda6e5`.
Result: **5 passed, 0 failed**.

The archive did not include the uncommitted backend fixes in the main working
directory. The tests were copied into that archive separately. No commit,
push, branch switch, database write, or IIS deployment was performed.

Initial report:
`backend-service/bin/demo-cicd-test-run/TestResults/demo-cicd-tests.trx`.

To rerun against that same isolated source from the repository root in PowerShell:

```powershell
& "$env:LOCALAPPDATA/Microsoft/dotnet/dotnet.exe" test backend-service/bin/demo-cicd-test-run/tests/SmartSolarMicrogrid.Tests/SmartSolarMicrogrid.Tests.csproj --no-restore -c Release --logger "console;verbosity=normal"
```

To run against the current working directory (including local fixes):

```powershell
& "$env:LOCALAPPDATA/Microsoft/dotnet/dotnet.exe" test tests/SmartSolarMicrogrid.Tests/SmartSolarMicrogrid.Tests.csproj -c Release
```

## Jenkins without committing tests

`tests/jenkins-test-stage.groovy` is a stage to paste inside the LiveDemo job's
`stages` block after checkout and before deployment. It copies these local test
files into Jenkins's workspace, then tests the backend checked out by Jenkins.
It archives the TRX result even when tests fail. Its absolute source path is
specific to this laptop. This stage has been prepared, not installed or run in
Jenkins.

The current GitHub backend still has the Production registration bug previously
identified. A full pipeline deployment from that unchanged branch will overwrite
the locally deployed fix. Until that is addressed, demonstrate tests separately
or omit deployment from a test-only Jenkins job.
