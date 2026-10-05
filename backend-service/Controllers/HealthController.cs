/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Controller for health check and MongoDB connectivity verification.
 * Last Modified: 2026-09-22
 */

using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace backend_service.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly IMongoDatabase _database;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IMongoDatabase database, ILogger<HealthController> logger)
    {
        // Initialize database and logger dependencies for health checks.
        _database = database;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetHealthStatus()
    {
        // Execute MongoDB ping command and return health status.
        try
        {
            await _database.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));

            return Ok(new
            {
                status = "Healthy",
                database = "Connected"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MongoDB health check failed.");

            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                status = "Unhealthy",
                database = "Unavailable"
            });
        }
    }
}
