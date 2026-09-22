/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Defines MongoDB configuration settings.
 * Last Modified: 2026-09-22
 */

namespace backend_service.Settings;

public class MongoDbSettings
{
    public string ConnectionString { get; set; } = string.Empty;
    public string DatabaseName { get; set; } = string.Empty;
    public string UsersCollectionName { get; set; } = string.Empty;
}
