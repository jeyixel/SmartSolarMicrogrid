using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace backend_service.Infrastructure;

/// <summary>
/// Turns model-binding and data-annotation failures into the module's own error
/// envelope, so a 400 from the framework looks like a 400 from the service.
/// </summary>
public static class ValidationProblemFactory
{
    public static IActionResult Create(ActionContext context)
    {
        var fieldErrors = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .ToDictionary(
                entry => ToCamelCase(entry.Key),
                entry => entry.Value!.Errors
                    .Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage)
                        ? "The supplied value is not valid."
                        : e.ErrorMessage)
                    .ToArray());

        // Coordinate problems get their own code: both the web map picker and
        // the mobile nearby search want to handle them specially.
        var isCoordinateFailure = fieldErrors.Keys.Any(
            k => k.Equals("latitude", StringComparison.OrdinalIgnoreCase)
              || k.Equals("longitude", StringComparison.OrdinalIgnoreCase));

        var response = new ApiErrorResponse
        {
            ErrorCode = isCoordinateFailure && fieldErrors.Count <= 2
                ? ErrorCodes.InvalidCoordinates
                : ErrorCodes.ValidationError,
            Message = isCoordinateFailure && fieldErrors.Count <= 2
                ? "Latitude must be between -90 and 90 and longitude between -180 and 180."
                : "One or more fields are invalid.",
            Details = fieldErrors,
            TraceId = context.HttpContext.TraceIdentifier
        };

        return new BadRequestObjectResult(response);
    }

    /// <summary>Matches the JSON casing of the response bodies.</summary>
    private static string ToCamelCase(string key)
    {
        if (string.IsNullOrEmpty(key))
        {
            return key;
        }

        // Model state keys can be paths such as "OperationalSchedule[0].OpenTime";
        // each segment is lower-cased individually.
        var segments = key.Split('.');
        for (var i = 0; i < segments.Length; i++)
        {
            var segment = segments[i];
            if (segment.Length > 0 && char.IsUpper(segment[0]))
            {
                segments[i] = char.ToLowerInvariant(segment[0]) + segment[1..];
            }
        }

        return string.Join('.', segments);
    }
}
