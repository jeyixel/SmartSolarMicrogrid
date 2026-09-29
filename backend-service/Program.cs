/*
 * Component: Application composition root.
 * Combines Member 1 (User Identity and Account Management),
 * Member 2 (Microgrid Node and Location Services), and
 * Member 3 (Energy Booking and Reservation Services).
 */

using System.Text;
using backend_service.Abstractions;
using backend_service.Data;
using backend_service.Infrastructure;
using backend_service.Models;
using backend_service.Repositories;
using backend_service.Services;
using backend_service.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using MongoDB.Bson.Serialization.Conventions;
using MongoDB.Driver;
using MongoDbSettings = backend_service.Settings.MongoDbSettings;
using StationMongoDbSettings = backend_service.Configuration.MongoDbSettings;

var builder = WebApplication.CreateBuilder(args);

// Configure MongoDB conventions once for all document models. This lets modules
// evolve independently without older documents failing deserialization.
var conventionPack = new ConventionPack
{
    new IgnoreExtraElementsConvention(true)
};
ConventionRegistry.Register("GlobalConventions", conventionPack, _ => true);

// MongoDB
//
// Two settings classes are bound deliberately: Member 1's users module reads the
// "MongoDbSettings" section, while Member 2's station module reads "MongoDb"
// plus ConnectionStrings:MongoDb. Both modules share the same IMongoClient and
// IMongoDatabase registration below.
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

builder.Services.Configure<StationMongoDbSettings>(
    builder.Configuration.GetSection(StationMongoDbSettings.SectionName));

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

// Module services

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

// Member 3: energy booking and reservations.
builder.Services.AddScoped<IEnergyBookingSlotRepository, EnergyBookingSlotRepository>();
builder.Services.AddScoped<IEnergyReservationRepository, EnergyReservationRepository>();
builder.Services.AddScoped<ISolarStationRepository, SolarStationRepository>();
builder.Services.AddScoped<IEnergyBookingSlotService, EnergyBookingSlotService>();
builder.Services.AddScoped<IEnergyReservationService, EnergyReservationService>();

// Member 3 owns the real implementation. Until it is registered, a stub reports
// no reservations so this module can be built and demonstrated on its own. It is
// refused outside Development, because an unguarded deactivation in production
// would silently break the rule it exists to enforce.
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<IReservationAvailabilityService, StubReservationAvailabilityService>();
}

// MVC
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.Configure<Microsoft.AspNetCore.Mvc.ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = ValidationProblemFactory.Create;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
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
        return new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecuritySchemeReference("Bearer", document),
                new List<string>()
            }
        };
    });
});

// Authentication and authorization.
var jwtSecretKey = builder.Configuration["JwtSettings:SecretKey"] ?? string.Empty;
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? string.Empty;
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? string.Empty;

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = !string.IsNullOrWhiteSpace(jwtSecretKey)
            ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey))
            : null,
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireBackofficeRole", policy =>
    {
        policy.RequireRole(UserRole.Backoffice.ToString());
    });

    options.AddPolicy("RequireGridOperatorRole", policy =>
    {
        policy.RequireRole(UserRole.GridOperator.ToString());
    });

    options.AddPolicy("RequireProsumerRole", policy =>
    {
        policy.RequireRole(UserRole.Prosumer.ToString());
    });
});

// CORS
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

// First, so it can catch anything thrown further down.
app.UseMiddleware<backend_service.Middleware.ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Smart Solar Microgrid API v1");
    });

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
