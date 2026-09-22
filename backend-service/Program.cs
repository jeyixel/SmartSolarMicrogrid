/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Configures services and the HTTP request pipeline
 * Last Modified: 2026-09-22
 */

using System.Text;
using backend_service.Middleware;
using backend_service.Models;
using backend_service.Services;
using backend_service.Settings;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
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

// Bind MongoDB configuration settings
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

// Bind JWT configuration settings
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("JwtSettings"));

// Register application services
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuthenticationService, AuthenticationService>();

// Register MongoDB client as a singleton
builder.Services.AddSingleton<IMongoClient>(sp =>
{
    // Resolve MongoDB settings and instantiate a singleton MongoClient
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    if (string.IsNullOrWhiteSpace(settings.ConnectionString))
    {
        throw new InvalidOperationException("MongoDB ConnectionString is not configured.");
    }

    return new MongoClient(settings.ConnectionString);
});

// Register MongoDB database as a singleton
builder.Services.AddSingleton<IMongoDatabase>(sp =>
{
    // Resolve MongoClient and settings to select and return the configured database
    var client = sp.GetRequiredService<IMongoClient>();
    var settings = sp.GetRequiredService<IOptions<MongoDbSettings>>().Value;
    if (string.IsNullOrWhiteSpace(settings.DatabaseName))
    {
        throw new InvalidOperationException("MongoDB DatabaseName is not configured.");
    }

    return client.GetDatabase(settings.DatabaseName);
});

// Configure JWT Bearer Authentication
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

// Configure CORS policy for frontend client
const string CorsPolicyName = "FrontendDevelopment";
builder.Services.AddCors(options =>
{
    // Define development CORS policy
    options.AddPolicy(name: CorsPolicyName, policy =>
    {
        // Configure the permitted frontend origin, headers, and HTTP methods.
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Global exception handling middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        // Configure Swagger UI endpoint and title
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Smart Solar Microgrid API v1");
    });
}

app.UseHttpsRedirection();

app.UseCors(CorsPolicyName);

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.Run();
