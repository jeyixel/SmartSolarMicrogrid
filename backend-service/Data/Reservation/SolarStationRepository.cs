using backend_service.Models;
using MongoDB.Driver;

namespace backend_service.Data;

public class SolarStationRepository : ISolarStationRepository
{
    private readonly IMongoCollection<SolarStationInfo> _stations;

    public SolarStationRepository(IMongoDatabase database)
    {
        _stations = database.GetCollection<SolarStationInfo>("SolarStationInfo");
    }

    public async Task<List<SolarStationInfo>> GetAllAsync() =>
        await _stations.Find(_ => true).ToListAsync();

    public async Task<SolarStationInfo?> GetByStationCodeAsync(string stationCode) =>
        await _stations.Find(x => x.StationCode == stationCode).FirstOrDefaultAsync();

    public async Task CreateAsync(SolarStationInfo station) =>
        await _stations.InsertOneAsync(station);

    public async Task UpdateAsync(string stationCode, SolarStationInfo station) =>
        await _stations.ReplaceOneAsync(x => x.StationCode == stationCode, station);
}
