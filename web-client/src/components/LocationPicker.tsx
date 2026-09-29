import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { cn } from '@/lib/utils';

/**
 * Marker icon.
 *
 * Leaflet's default icon resolves its images by relative URL, which breaks once
 * Vite bundles and hashes assets. Building the icon from the imported asset URLs
 * is the standard fix, and it survives the production build.
 */
const markerIcon = new L.Icon({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  /** Called when the pin moves. Omit to render a read-only map. */
  onChange?: (latitude: number, longitude: number) => void;
  className?: string;
  /** Used when no pin is set yet. Defaults to central Colombo. */
  fallbackCenter?: [number, number];
}

const DEFAULT_CENTER: [number, number] = [6.9271, 79.8612];

/**
 * Click-to-place map for a station's GPS position.
 *
 * Drives Leaflet through refs rather than react-leaflet, because the map is an
 * imperative object with its own lifecycle and wrapping it adds a layer without
 * adding much here. Coordinates remain the source of truth: the numeric inputs
 * and this map are two views of the same two numbers.
 */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
  className,
  fallbackCenter = DEFAULT_CENTER,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Held in a ref so moving the pin does not need to tear down the map.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const hasPin = latitude !== null && longitude !== null;
  const center = useMemo<[number, number]>(
    () => (hasPin ? [latitude, longitude] : fallbackCenter),
    [hasPin, latitude, longitude, fallbackCenter],
  );

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: hasPin ? 14 : 11,
      scrollWheelZoom: false, // Scrolling the page should not zoom the map.
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (onChangeRef.current) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        // wrap() keeps the longitude inside -180..180 when the user pans past
        // the antimeridian. Six decimals is roughly 0.1 m — far beyond what a
        // station needs, and it keeps the numeric inputs readable.
        const { lat, lng } = event.latlng.wrap();
        onChangeRef.current?.(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Deliberately once: later coordinate changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker and the view in step with the coordinates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasPin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const position: [number, number] = [latitude, longitude];

    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    } else {
      markerRef.current = L.marker(position, {
        icon: markerIcon,
        draggable: Boolean(onChangeRef.current),
      }).addTo(map);

      markerRef.current.on('dragend', () => {
        // wrap() brings the longitude back into -180..180 after a drag across
        // the antimeridian, which the API requires.
        const { lat, lng } = markerRef.current!.getLatLng().wrap();
        onChangeRef.current?.(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      });
    }

    // Pan only when the pin has left the visible area, so typing into the
    // latitude field does not yank the map on every keystroke.
    if (!map.getBounds().contains(position)) {
      map.setView(position, Math.max(map.getZoom(), 13));
    }
  }, [hasPin, latitude, longitude]);

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-md border"
        // Leaflet renders into this element directly.
        role="application"
        aria-label={
          onChange
            ? 'Map for choosing the station location. Click the map to place the pin, or type coordinates into the latitude and longitude fields.'
            : 'Map showing the station location.'
        }
      />
      {onChange && (
        <p className="text-xs text-muted-foreground">
          Click the map or drag the pin to set the position. The latitude and
          longitude fields stay editable if you prefer to type exact values.
        </p>
      )}
    </div>
  );
}
