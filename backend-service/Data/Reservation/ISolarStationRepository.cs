using backend_service.Models;

namespace backend_service.Data;

public interface ISolarStationRepository
{
    Task<List<SolarStationInfo>> GetAllAsync();
    Task<SolarStationInfo?> GetByStationCodeAsync(string stationCode);
    Task CreateAsync(SolarStationInfo station);
    Task UpdateAsync(string stationCode, SolarStationInfo station);
}
