/*
 * Student Name: Waru Randima
 * IT Number: IT23163690
 * Component: User Identity and Account Management
 * File Purpose: Global exception handling middleware for centralized error management.
 * Last Modified: 2026-09-22
 */

using System.Text.Json;
using backend_service.Exceptions;

namespace backend_service.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        // Initialize next request delegate and logger for global exception handling.
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Intercept HTTP requests to catch and safely handle unhandled exceptions.
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        // Generate a standardized, safe error response without leaking internal secrets or stack traces.
        context.Response.ContentType = "application/json";

        int statusCode;
        string message;

        switch (ex)
        {
            case UnauthorizedAccessException:
                statusCode = StatusCodes.Status401Unauthorized;
                message = ex.Message;
                _logger.LogWarning(ex, "Unauthorized request: {Message}", ex.Message);
                break;

            case AccountStatusException:
                statusCode = StatusCodes.Status403Forbidden;
                message = ex.Message;
                _logger.LogWarning(ex, "Forbidden access due to account status: {Message}", ex.Message);
                break;

            case ConflictException:
                statusCode = StatusCodes.Status409Conflict;
                message = ex.Message;
                _logger.LogWarning(ex, "Conflict error: {Message}", ex.Message);
                break;

            case ArgumentException or BadHttpRequestException:
                statusCode = StatusCodes.Status400BadRequest;
                message = ex.Message;
                _logger.LogWarning(ex, "Bad request validation error: {Message}", ex.Message);
                break;

            default:
                statusCode = StatusCodes.Status500InternalServerError;
                message = "An unexpected error occurred.";
                _logger.LogError(ex, "An unhandled exception occurred during request execution.");
                break;
        }

        context.Response.StatusCode = statusCode;

        var response = new
        {
            message
        };

        var jsonResponse = JsonSerializer.Serialize(response);
        await context.Response.WriteAsync(jsonResponse);
    }
}
