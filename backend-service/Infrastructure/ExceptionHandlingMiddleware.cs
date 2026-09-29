using System.Text.Json;

namespace backend_service.Infrastructure;

/// <summary>
/// Last line of defence: converts anything that escaped the controllers into the
/// standard error envelope. A driver message or stack trace must never reach a
/// client — it is logged instead, and the caller gets a trace id to quote.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // The client hung up; there is nobody left to send a response to.
            _logger.LogInformation("Request {TraceId} was cancelled by the client.", context.TraceIdentifier);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception on {Method} {Path} (trace {TraceId}).",
                context.Request.Method, context.Request.Path, context.TraceIdentifier);

            if (context.Response.HasStarted)
            {
                // Headers are already on the wire; rewriting the body would
                // produce a malformed response.
                _logger.LogWarning("Response for {TraceId} had already started; cannot write an error envelope.",
                    context.TraceIdentifier);
                throw;
            }

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var payload = new ApiErrorResponse
            {
                ErrorCode = ErrorCodes.InternalError,
                Message = "An unexpected error occurred while processing the request.",
                TraceId = context.TraceIdentifier
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            }));
        }
    }
}

public static class ExceptionHandlingMiddlewareExtensions
{
    public static IApplicationBuilder UseStandardErrorHandling(this IApplicationBuilder app) =>
        app.UseMiddleware<ExceptionHandlingMiddleware>();
}
