using backend_service.Abstractions;
using backend_service.Infrastructure;
using backend_service.Models;
using backend_service.Repositories;
using backend_service.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace SmartSolarMicrogrid.Tests;

// Test the business rules with isolated dependencies: no Atlas writes or IIS deployment.
public class StationDeactivationTests
{
    private const string StationId = "507f1f77bcf86cd799439011";
    private const string OperatorId = "demo-operator";
    private readonly Mock<IStationRepository> _stations = new(MockBehavior.Strict);
    private readonly Mock<IReservationAvailabilityService> _reservations = new(MockBehavior.Strict);
    private readonly Mock<IScheduleEvaluator> _schedule = new();

    private StationService CreateService() => new(
        _stations.Object, _reservations.Object, _schedule.Object,
        NullLogger<StationService>.Instance);

    private SolarStationInfo ExistingStation()
    {
        var station = new SolarStationInfo
        {
            Id = StationId, StationCode = "DEMO-01", Name = "Demo Station",
            Status = StationStatus.Active
        };
        _stations.Setup(x => x.GetByIdAsync(StationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(station);
        return station;
    }

    [Fact]
    public async Task Invalid_station_id_is_rejected_before_database_access()
    {
        var result = await CreateService().DeactivateAsync("invalid-id", null, OperatorId);

        Assert.False(result.Succeeded);
        Assert.Equal(ServiceError.Validation, result.Error);
        _stations.VerifyNoOtherCalls();
        _reservations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Missing_station_returns_not_found_without_checking_reservations()
    {
        _stations.Setup(x => x.GetByIdAsync(StationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((SolarStationInfo?)null);

        var result = await CreateService().DeactivateAsync(StationId, null, OperatorId);

        Assert.Equal(ServiceError.NotFound, result.Error);
        _reservations.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Active_reservations_block_station_deactivation()
    {
        var station = ExistingStation();
        _reservations.Setup(x => x.GetActiveReservationCountAsync(StationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        var result = await CreateService().DeactivateAsync(StationId, "maintenance", OperatorId);

        Assert.Equal(ServiceError.HasActiveReservations, result.Error);
        Assert.Equal(StationStatus.Active, station.Status);
        _stations.Verify(x => x.TryChangeStatusAsync(
            It.IsAny<string>(), It.IsAny<StationStatus>(), It.IsAny<StationStatus>(),
            It.IsAny<DateTime?>(), It.IsAny<string?>(), It.IsAny<string>(),
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Reservation_database_failure_blocks_deactivation()
    {
        var station = ExistingStation();
        _reservations.Setup(x => x.GetActiveReservationCountAsync(StationId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("Simulated reservation database outage"));

        var result = await CreateService().DeactivateAsync(StationId, null, OperatorId);

        Assert.Equal(ServiceError.ReservationServiceUnavailable, result.Error);
        Assert.Equal(StationStatus.Active, station.Status);
        _stations.Verify(x => x.TryChangeStatusAsync(
            It.IsAny<string>(), It.IsAny<StationStatus>(), It.IsAny<StationStatus>(),
            It.IsAny<DateTime?>(), It.IsAny<string?>(), It.IsAny<string>(),
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task No_active_reservations_allows_deactivation_and_records_operator()
    {
        var station = ExistingStation();
        _reservations.Setup(x => x.GetActiveReservationCountAsync(StationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
        _stations.Setup(x => x.TryChangeStatusAsync(
            StationId, StationStatus.Active, StationStatus.Inactive,
            It.IsAny<DateTime?>(), "maintenance", OperatorId,
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var result = await CreateService().DeactivateAsync(StationId, " maintenance ", OperatorId);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.Value);
        Assert.Equal(StationStatus.Inactive, station.Status);
        Assert.Equal("maintenance", station.DeactivationReason);
        Assert.Equal(OperatorId, station.UpdatedByUserId);
        Assert.NotNull(station.DeactivatedAtUtc);
        _stations.VerifyAll();
        _reservations.VerifyAll();
    }
}
