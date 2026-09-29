using backend_service.Configuration;
using backend_service.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace backend_service.Infrastructure;

/// <summary>
/// Creates the station collection's indexes once at startup. Index creation is
/// idempotent, so running on every boot is safe.
/// </summary>
/// <remarks>
/// Startup does not fail when this cannot run: an unreachable database at boot
/// should not stop the process from starting and recovering. The failure is
/// logged loudly instead.
/// </remarks>
public sealed class MongoIndexInitializer : IHostedService
{
    private readonly IMongoClient _client;
    private readonly MongoDbSettings _settings;
    private readonly ILogger<MongoIndexInitializer> _logger;

    public MongoIndexInitializer(
        IMongoClient client,
        IOptions<MongoDbSettings> settings,
        ILogger<MongoIndexInitializer> logger)
    {
        _client = client;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            var collection = _client
                .GetDatabase(_settings.DatabaseName)
                .GetCollection<SolarStationInfo>(_settings.StationsCollectionName);

            var indexes = new List<CreateIndexModel<SolarStationInfo>>
            {
                // Unique station code. Codes are upper-cased before they are
                // stored, so a plain unique index is already case-insensitive in
                // effect and still catches a race that slipped past the
                // service-level duplicate check.
                new(
                    Builders<SolarStationInfo>.IndexKeys.Ascending(s => s.StationCode),
                    new CreateIndexOptions { Name = "ux_stationCode", Unique = true }),

                // Nearly every mobile query filters on status.
                new(
                    Builders<SolarStationInfo>.IndexKeys.Ascending(s => s.Status),
                    new CreateIndexOptions { Name = "ix_status" }),

                // Supports the bounding-box pre-filter of the nearby search.
                new(
                    Builders<SolarStationInfo>.IndexKeys
                        .Ascending(s => s.Status)
                        .Ascending(s => s.Latitude)
                        .Ascending(s => s.Longitude),
                    new CreateIndexOptions { Name = "ix_status_lat_lon" })
            };

            await collection.Indexes.CreateManyAsync(indexes, cancellationToken);

            _logger.LogInformation("Station collection indexes are in place.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Could not create indexes on '{Collection}'. The API will still start, but station code " +
                "uniqueness is not enforced by the database until this succeeds.",
                _settings.StationsCollectionName);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
