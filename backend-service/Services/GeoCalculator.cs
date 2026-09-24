namespace backend_service.Services;

/// <summary>Great-circle distance and the bounding box used to narrow a radius search.</summary>
public static class GeoCalculator
{
    private const double EarthRadiusKm = 6371.0088;

    /// <summary>Haversine distance between two points, in kilometres.</summary>
    public static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusKm * c;
    }

    /// <summary>
    /// Smallest latitude/longitude box containing every point within
    /// <paramref name="radiusKm"/>. Used to pre-filter in the database before
    /// the exact Haversine test, which no box can replace.
    /// </summary>
    public static (double MinLat, double MaxLat, double MinLon, double MaxLon) BoundingBox(
        double latitude, double longitude, double radiusKm)
    {
        var latDelta = ToDegrees(radiusKm / EarthRadiusKm);

        var minLat = latitude - latDelta;
        var maxLat = latitude + latDelta;

        // A circle that reaches over a pole covers every longitude, and the
        // usual widening formula breaks down there.
        if (minLat <= -90.0 || maxLat >= 90.0)
        {
            return (Math.Max(-90.0, minLat), Math.Min(90.0, maxLat), -180.0, 180.0);
        }

        // Longitude degrees shrink towards the poles, so the box must be widened
        // using the latitude where they are shortest — the edge of the band
        // nearest a pole, not the query latitude. Widening at the query latitude
        // is the classic form of this bug: it produces a box that excludes real
        // matches lying poleward of the query point.
        var worstLatitude = Math.Max(Math.Abs(minLat), Math.Abs(maxLat));
        var cosLat = Math.Cos(ToRadians(worstLatitude));
        if (Math.Abs(cosLat) < 1e-9)
        {
            return (minLat, maxLat, -180.0, 180.0);
        }

        // sin(r/R)/cos(lat) is the exact half-width; the flat r/R/cos(lat)
        // approximation understates it and loses edge matches.
        var sinLonDelta = Math.Sin(radiusKm / EarthRadiusKm) / cosLat;
        if (sinLonDelta >= 1.0)
        {
            return (minLat, maxLat, -180.0, 180.0);
        }

        var lonDelta = ToDegrees(Math.Asin(sinLonDelta));
        if (lonDelta >= 180.0)
        {
            return (minLat, maxLat, -180.0, 180.0);
        }

        // Wrapped values are intentional: the repository turns a wrapped box
        // (min > max) into an OR across the antimeridian.
        var minLon = WrapLongitude(longitude - lonDelta);
        var maxLon = WrapLongitude(longitude + lonDelta);

        return (minLat, maxLat, minLon, maxLon);
    }

    private static double WrapLongitude(double longitude)
    {
        var wrapped = (longitude + 180.0) % 360.0;
        if (wrapped < 0)
        {
            wrapped += 360.0;
        }

        return wrapped - 180.0;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;

    private static double ToDegrees(double radians) => radians * 180.0 / Math.PI;
}
