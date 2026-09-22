using MongoDB.Driver;
using backend_service.Data;
using backend_service.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Setup MongoDB
var mongoClient = new MongoClient(builder.Configuration.GetConnectionString("MongoDb") ?? "mongodb://localhost:27017");
var mongoDatabase = mongoClient.GetDatabase("SmartSolarMicrogrid");
builder.Services.AddSingleton(mongoDatabase);

// Setup DI
builder.Services.AddScoped<IEnergyBookingSlotRepository, EnergyBookingSlotRepository>();
builder.Services.AddScoped<IEnergyReservationRepository, EnergyReservationRepository>();
builder.Services.AddScoped<IEnergyBookingSlotService, EnergyBookingSlotService>();
builder.Services.AddScoped<IEnergyReservationService, EnergyReservationService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.Run();
