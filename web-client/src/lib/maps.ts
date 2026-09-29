/**
 * Google Maps deep links.
 *
 * These use Google's documented URL scheme, which needs no API key, no billing
 * account and no script tag — the browser simply opens maps.google.com. The
 * in-page map stays Leaflet; this is for "show me this place in Google Maps",
 * and for handing a driver turn-by-turn directions.
 *
 * https://developers.google.com/maps/documentation/urls/get-started
 */

/** Coordinates are passed as plain decimals; Google expects "lat,lng". */
function asPair(latitude: number, longitude: number): string {
  return `${latitude},${longitude}`;
}

/**
 * Opens the map centred on the station with a pin dropped at its exact
 * position. `query` takes coordinates rather than a name so the pin lands on
 * the station itself rather than on whatever Google thinks the name means.
 */
export function googleMapsPlaceUrl(latitude: number, longitude: number, zoom = 17): string {
  const params = new URLSearchParams({
    api: '1',
    query: asPair(latitude, longitude),
  });

  // `basemap` and `zoom` are honoured by the search endpoint and make the pin
  // land at a useful scale rather than fully zoomed out.
  return `https://www.google.com/maps/search/?${params.toString()}&zoom=${zoom}`;
}

/** Turn-by-turn directions from wherever the user is, to the station. */
export function googleMapsDirectionsUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    api: '1',
    destination: asPair(latitude, longitude),
    travelmode: 'driving',
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Street View at the station, which is often the quickest way for an operator
 * to confirm the pin is on the right building.
 */
export function googleMapsStreetViewUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    api: '1',
    map_action: 'pano',
    viewpoint: asPair(latitude, longitude),
  });

  return `https://www.google.com/maps/@?${params.toString()}`;
}
