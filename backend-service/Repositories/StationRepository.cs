using backend_service.Configuration;
using backend_service.Models;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace backend_service.Repositories;

/// <summary>MongoDB-backed implementation of <see cref="IStationRepository"/>.</summary>
public sealed class StationRepository : IStationRepository
{
    private readonly IMongoCollection<SolarStationInfo> _stations;

    public StationRepository(IMongoClient client, IOptions<MongoDbSettings> settings)
    {
        var config = settings.Value;
        var database = client.GetDatabase(config.DatabaseName);
        _stations = database.GetCollection<SolarStationInfo>(config.StationsCollectionName);
    }

    public async Task<SolarStationInfo> CreateAsync(SolarStationInfo station, CancellationToken cancellationToken = default)
    {
        await _stations.InsertOneAsync(station, cancellationToken: cancellationToken);
        return station;
    }

    public async Task<SolarStationInfo?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        // Callers validate the id format first; this guard keeps a malformed id
        // from reaching the driver and surfacing as a 500.
        if (!ObjectId.TryParse(id, out _))
        {
            return null;
        }

        return await _stations
            .Find(s => s.Id == id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<(List<SolarStationInfo> Items, long TotalCount)> GetPagedAsync(
        StationStatus? status,
        string? search,
        int page,
        int pageSize,
        string sortBy,
        bool ascending,
        CancellationToken cancellationToken = default)
    {
        var builder = Builders<SolarStationInfo>.Filter;
        var filter = builder.Empty;

        if (status.HasValue)
        {
            filter &= builder.Eq(s => s.Status, status.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Escaped so a user typing "." or "*" searches for those characters
            // rather than injecting a pattern.
            var pattern = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(search.Trim()), "i");
            filter &= builder.Or(
                builder.Regex(s => s.Name, pattern),
                builder.Regex(s => s.StationCode, pattern));
        }

        var totalCount = await _stations.CountDocumentsAsync(filter, cancellationToken: cancellationToken);

        // sortBy is restricted to an allow-list by the service before it gets here.
        var sortDefinition = sortBy switch
        {
            "createdAtUtc" => ascending
                ? Builders<SolarStationInfo>.Sort.Ascending(s => s.CreatedAtUtc)
                : Builders<SolarStationInfo>.Sort.Descending(s => s.CreatedAtUtc),
            "stationCode" => ascending
                ? Builders<SolarStationInfo>.Sort.Ascending(s => s.StationCode)
                : Builders<SolarStationInfo>.Sort.Descending(s => s.StationCode),
            _ => ascending
                ? Builders<SolarStationInfo>.Sort.Ascending(s => s.Name)
                : Builders<SolarStationInfo>.Sort.Descending(s => s.Name)
        };

        var items = await _stations
            .Find(filter)
            .Sort(sortDefinition)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<bool> ReplaceAsync(SolarStationInfo station, CancellationToken cancellationToken = default)
    {
        var result = await _stations.ReplaceOneAsync(
            s => s.Id == station.Id,
            station,
            new ReplaceOptions { IsUpsert = false },
            cancellationToken);

        return result.MatchedCount > 0;
    }

    public async Task<bool> TryChangeStatusAsync(
        string id,
        StationStatus expectedCurrentStatus,
        StationStatus newStatus,
        DateTime? deactivatedAtUtc,
        string? deactivationReason,
        string updatedByUserId,
        DateTime updatedAtUtc,
        CancellationToken cancellationToken = default)
    {
        if (!ObjectId.TryParse(id, out _))
        {
            return false;
        }

        // Matching on the expected current status makes this a compare-and-swap:
        // two simultaneous deactivations cannot both succeed.
        var filter = Builders<SolarStationInfo>.Filter.And(
            Builders<SolarStationInfo>.Filter.Eq(s => s.Id, id),
            Builders<SolarStationInfo>.Filter.Eq(s => s.Status, expectedCurrentStatus));

        var update = Builders<SolarStationInfo>.Update
            .Set(s => s.Status, newStatus)
            .Set(s => s.UpdatedAtUtc, updatedAtUtc)
            .Set(s => s.UpdatedByUserId, updatedByUserId)
            .Set(s => s.DeactivatedAtUtc, deactivatedAtUtc)
            .Set(s => s.DeactivationReason, deactivationReason);

        var result = await _stations.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> StationCodeExistsAsync(string stationCode, string? excludingId = null, CancellationToken cancellationToken = default)
    {
        // Anchored, escaped, case-insensitive: "CMB-01" and "cmb-01" collide.
        var pattern = new BsonRegularExpression(
            "^" + System.Text.RegularExpressions.Regex.Escape(stationCode) + "$", "i");

        var filter = Builders<SolarStationInfo>.Filter.Regex(s => s.StationCode, pattern);

        if (!string.IsNullOrWhiteSpace(excludingId))
        {
            filter &= Builders<SolarStationInfo>.Filter.Ne(s => s.Id, excludingId);
        }

        return await _stations.Find(filter).AnyAsync(cancellationToken);
    }

    public async Task<List<SolarStationInfo>> GetActiveStationsAsync(CancellationToken cancellationToken = default)
    {
        return await _stations
            .Find(s => s.Status == StationStatus.Active)
            .SortBy(s => s.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<SolarStationInfo>> GetActiveStationsInBoundingBoxAsync(
        double minLatitude,
        double maxLatitude,
        double minLongitude,
        double maxLongitude,
        CancellationToken cancellationToken = default)
    {
        var builder = Builders<SolarStationInfo>.Filter;
        var filter = builder.Eq(s => s.Status, StationStatus.Active)
                     & builder.Gte(s => s.Latitude, minLatitude)
                     & builder.Lte(s => s.Latitude, maxLatitude);

        // A box spanning the antimeridian has min > max; it then covers two
        // ranges and needs an OR rather than a between.
        filter &= minLongitude <= maxLongitude
            ? builder.Gte(s => s.Longitude, minLongitude) & builder.Lte(s => s.Longitude, maxLongitude)
            : builder.Gte(s => s.Longitude, minLongitude) | builder.Lte(s => s.Longitude, maxLongitude);

        return await _stations.Find(filter).ToListAsync(cancellationToken);
    }
}
