import { ExternalLink, Map, Navigation, Camera } from 'lucide-react';

import {
  googleMapsDirectionsUrl,
  googleMapsPlaceUrl,
  googleMapsStreetViewUrl,
} from '@/lib/maps';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GoogleMapsLinksProps {
  latitude: number;
  longitude: number;
  /** Named in the accessible labels, so each link says which station it opens. */
  stationName?: string;
  /** Street View is useful when confirming a pin, noise elsewhere. */
  showStreetView?: boolean;
  className?: string;
}

/**
 * Opens a station's position in Google Maps.
 *
 * Deep links rather than an embedded map: no API key, no billing account, and
 * nothing to configure before a demo. The in-page map stays Leaflet — this is
 * for verifying a pin against Google's imagery and for getting directions.
 */
export function GoogleMapsLinks({
  latitude,
  longitude,
  stationName,
  showStreetView = false,
  className,
}: GoogleMapsLinksProps) {
  const suffix = stationName ? ` for ${stationName}` : '';

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button variant="outline" size="sm" asChild>
        <a
          href={googleMapsPlaceUrl(latitude, longitude)}
          target="_blank"
          // noopener/noreferrer: a new tab opened this way can otherwise reach
          // back into this page through window.opener.
          rel="noopener noreferrer"
          aria-label={`Open the location${suffix} in Google Maps (opens in a new tab)`}
        >
          <Map className="h-4 w-4" aria-hidden="true" />
          Open in Google Maps
          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
        </a>
      </Button>

      <Button variant="outline" size="sm" asChild>
        <a
          href={googleMapsDirectionsUrl(latitude, longitude)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Get driving directions${suffix} (opens in a new tab)`}
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Directions
          <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
        </a>
      </Button>

      {showStreetView && (
        <Button variant="outline" size="sm" asChild>
          <a
            href={googleMapsStreetViewUrl(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open Street View${suffix} (opens in a new tab)`}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Street View
            <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  );
}
