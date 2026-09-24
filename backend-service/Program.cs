/*
 * Component: Application composition root.
 * Combines Member 1 (User Identity and Account Management) and
 * Member 2 (Microgrid Node and Location Services).
 */

using System.Text;
using backend_service.Abstractions;
using backend_service.Infrastructure;
using backend_service.Middleware;
using backend_service.Models;
using backend_service.Repositories;
using backend_service.Services;
using backend_service.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using MongoDB.Driver;
using MongoDbSettings = backend_service.Settings.MongoDbSettings;
using StationMongoDbSettings = backend_service.Configuration.MongoDbSettings;

var builder = WebApplication.CreateBuilder(args);

// ── MongoDB ──────────────────────────────────────────────────────────────────
//
// Two settings classes are bound deliberately: Member 1's users module reads the
// "MongoDbSettings" section, Member 2's station module reads "MongoDb" plus the
// ConnectionStrings entry. They address the same database; only the collection
// names differ, so each module keeps its own binding rather than one module
// depending on the other's configuration shape.

builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

builder.Services.Configure<StationMongoDbSettings>(
    builder.Configuration.GetSection(StationMongoDbSettings.SectionName));

// The connection string lives under ConnectionStrings so it can be overridden by
// IIS configuration or an environment variable without editing a settings file.
// Whichever of the two sources is populated wins, so a single connection string
// serves both modules.
builder.Services.PostConfigure<StationMongoDbSettings>(settings =>
{
    var connectionString = builder.Configuration.GetConnectionString("MongoDb");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        connectionString = builder.Configuration["MongoDbSettings:ConnectionString"];
    }

    if (!string.IsNullOrWhiteSpace(connectionString))
    {
        settings.ConnectionString = connectionString;
    }
});

builder.Services.PostConfigure<MongoDbSettings>(settings =>
{
    if (string.IsNullOrWhiteSpace(settings.ConnectionString))
    {
        settings.ConnectionString =
            builder.Configuration.GetConnectionString("MongoDb") ?? string.Empty;
    }
});

// The driver's client is expensive to build and pools internally, so exactly one
// is shared for the lifetime of the process.
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    var connectionString = settings.ConnectionString;

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        connectionString = sp.GetRequiredService<IOptions<StationMongoDbSettings>>()
            .Value.ConnectionString;
    }

    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            "No MongoDB connection string was configured. Set ConnectionStrings:MongoDb " +
            "or MongoDbSettings:ConnectionString in appsettings.Development.json locally, " +
            "or in the site configuration under IIS.");
    }

    return new MongoClient(connectionString);
});

// Register MongoDB database as a singleton (used by the users module).
builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    if (string.IsNullOrWhiteSpace(settings.DatabaseName))
    {
        throw new InvalidOperationException("MongoDB DatabaseName is not configured.");
    }

    return client.GetDatabase(settings.DatabaseName);
});

builder.Services.AddHostedService<MongoIndexInitializer>();

// ── Module services ──────────────────────────────────────────────────────────

// Member 1: identity and account management.
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("JwtSettings"));
builder.Services.Configure<BootstrapAdminSettings>(
    builder.Configuration.GetSection("BootstrapAdmin"));

builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthenticationService, AuthenticationService>();
builder.Services.AddScoped<DevelopmentAdminSeeder>();

// Member 2: microgrid nodes.
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

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // Configure Swagger document metadata and JWT security scheme
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Smart Solar Microgrid API",
        Version = "v1"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme."
    });

    c.AddSecurityRequirement(document =>
    {
        // Add global Bearer security requirement
        return new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecuritySchemeReference("Bearer", document),
                new List<string>()
            }
        };
    });
});

// ── Authentication and authorization ─────────────────────────────────────────
//
// Member 1's JWT bearer scheme is now the single authentication mechanism. The
// development header handler that previously stood in for it has been removed:
// every module, including the station endpoints, authenticates with a real
// token. Mobile and web clients must send "Authorization: Bearer <token>".

var jwtSecretKey = builder.Configuration["JwtSettings:SecretKey"] ?? string.Empty;
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? string.Empty;
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? string.Empty;

builder.Services.AddAuthentication(options =>
{
    // Configure default authentication scheme to JWT Bearer
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    // Configure token validation parameters for incoming JWTs
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = !string.IsNullOrWhiteSpace(jwtSecretKey) ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)) : null,
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

// Configure Role-Based Authorization Policies
builder.Services.AddAuthorization(options =>
{
    // Define named authorization policies matching system role matrix
    options.AddPolicy("RequireBackofficeRole", policy =>
    {
        // Require Backoffice role for administrative and user management operations
        policy.RequireRole(UserRole.Backoffice.ToString());
    });

    options.AddPolicy("RequireGridOperatorRole", policy =>
    {
        // Require GridOperator role for operational and grid management operations
        policy.RequireRole(UserRole.GridOperator.ToString());
    });

    options.AddPolicy("RequireProsumerRole", policy =>
    {
        // Require Prosumer role for self-service account and energy operations
        policy.RequireRole(UserRole.Prosumer.ToString());
    });
});

// ── CORS ─────────────────────────────────────────────────────────────────────
//
// One policy for every browser client. Origins come from configuration so a
// deployment can restrict them without a code change; the development defaults
// cover the React dev server on both its common ports.
const string WebClientCorsPolicy = "WebClient";
builder.Services.AddCors(options =>
{
    options.AddPolicy(WebClientCorsPolicy, policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? Array.Empty<string>();

        if (allowedOrigins.Length == 0)
        {
            allowedOrigins = new[] { "http://localhost:3000", "http://localhost:5173" };
        }

        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

// ── Pipeline ─────────────────────────────────────────────────────────────────

// First, so it can catch anything thrown further down. Fully qualified because
// both modules defined a class of this name; Member 1's version is used since
// it also translates the identity module's exceptions.
app.UseMiddleware<backend_service.Middleware.ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        // Configure Swagger UI endpoint and title
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Smart Solar Microgrid API v1");
    });

    // Seed initial development administrator account
    using (var scope = app.Services.CreateScope())
    {
        var seeder = scope.ServiceProvider.GetRequiredService<DevelopmentAdminSeeder>();
        await seeder.SeedAsync();
    }
}
else
{
    app.UseHttpsRedirection();
}

app.UseRouting();

app.UseCors(WebClientCorsPolicy);

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

await app.RunAsync();
