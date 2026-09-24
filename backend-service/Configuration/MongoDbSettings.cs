namespace backend_service.Configuration;

/// <summary>
/// Binds the <c>MongoDb</c> configuration section. The connection string is read
/// from <c>ConnectionStrings:MongoDb</c> so it can be overridden per environment
/// (and, in IIS, from the site configuration rather than a committed file).
/// </summary>
public sealed class MongoDbSettings
{
    public const string SectionName = "MongoDb";

    public string ConnectionString { get; set; } = string.Empty;

    public string DatabaseName { get; set; } = "SmartSolarMicrogrid";

    public string StationsCollectionName { get; set; } = "SolarStationInfo";
}
