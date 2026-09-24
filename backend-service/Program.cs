using backend_service.Abstractions;
using backend_service.Configuration;
using backend_service.Infrastructure;
using backend_service.Repositories;
using backend_service.Services;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

// ── MongoDB ──────────────────────────────────────────────────────────────────

builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection(MongoDbSettings.SectionName));

// The connection string lives under ConnectionStrings so it can be overridden by
// IIS configuration or an environment variable without editing a settings file.
builder.Services.PostConfigure<MongoDbSettings>(settings =>
{
    var connectionString = builder.Configuration.GetConnectionString("MongoDb");
    if (!string.IsNullOrWhiteSpace(connectionString))
    {
        settings.ConnectionString = connectionString;
    }
});

// The driver's client is expensive to build and pools internally, so exactly one
// is shared for the lifetime of the process.
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;

    if (string.IsNullOrWhiteSpace(settings.ConnectionString))
    {
        throw new InvalidOperationException(
            "No MongoDB connection string was configured. Set ConnectionStrings:MongoDb " +
            "in appsettings.Development.json locally, or in the site configuration under IIS.");
    }

    return new MongoClient(settings.ConnectionString);
});

builder.Services.AddHostedService<MongoIndexInitializer>();

// ── Module services ──────────────────────────────────────────────────────────

builder.Services.AddScoped<IStationRepository, StationRepository>();
builder.Services.AddScoped<IStationService, StationService>();
builder.Services.AddSingleton<IScheduleEvaluator, ScheduleEvaluator>();

// Member 3 owns the real implementation. Until it is registered, a stub reports
// no reservations so this module can be built and demonstrated on its own. It is
// refused outside Development, because an unguarded deactivation in production
// would silently break the rule it exists to enforce.
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<IReservationAvailabilityService, StubReservationAvailabilityService>();
}

// ── MVC ──────────────────────────────────────────────────────────────────────

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// Binding and data-annotation failures return the module's own error envelope
// rather than the framework's ProblemDetails, so clients parse one shape.
builder.Services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = ValidationProblemFactory.Create;
});

builder.Services.AddOpenApi();

// Authentication belongs to Member 1; this module only declares which roles each
// endpoint needs. Until that scheme exists, a development-only header handler
// stands in so the station endpoints can be exercised in Postman. Remove this
// block once Member 1 registers the real scheme — the endpoints need no change.
if (builder.Environment.IsDevelopment())
{
    builder.Services
        .AddAuthentication(DevelopmentAuthenticationHandler.SchemeName)
        .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, DevelopmentAuthenticationHandler>(
            DevelopmentAuthenticationHandler.SchemeName, _ => { });
}

builder.Services.AddAuthorization();

// The web client is served from a different origin than the API.
const string WebClientCorsPolicy = "WebClient";
builder.Services.AddCors(options =>
{
    options.AddPolicy(WebClientCorsPolicy, policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? Array.Empty<string>();

        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
        }
        else
        {
            // No configured origins: allow any, but without credentials. Set
            // Cors:AllowedOrigins before deploying.
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        }
    });
});

var app = builder.Build();

// ── Pipeline ─────────────────────────────────────────────────────────────────

// First, so it can catch anything thrown further down.
app.UseStandardErrorHandling();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors(WebClientCorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
