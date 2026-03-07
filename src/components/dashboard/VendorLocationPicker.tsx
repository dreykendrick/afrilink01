import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, Search, CheckCircle2 } from 'lucide-react';

// Fix default marker icon path for bundled builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface VendorLocation {
  lat: number;
  lng: number;
  address: string;
}

interface VendorLocationPickerProps {
  initialLocation?: VendorLocation | null;
  onLocationChange: (location: VendorLocation) => void;
  /** Compact mode hides the header */
  compact?: boolean;
}

// Default center: Dar es Salaam
const DEFAULT_CENTER: [number, number] = [-6.7924, 39.2083];
const DEFAULT_ZOOM = 13;

export const VendorLocationPicker = ({
  initialLocation,
  onLocationChange,
  compact = false,
}: VendorLocationPickerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [address, setAddress] = useState(initialLocation?.address || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hasPin, setHasPin] = useState(!!initialLocation);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      return data.display_name || '';
    } catch {
      return '';
    }
  }, []);

  const updateMarker = useCallback(
    async (lat: number, lng: number, skipGeocode = false) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', async () => {
          const pos = markerRef.current!.getLatLng();
          const addr = await reverseGeocode(pos.lat, pos.lng);
          setAddress(addr);
          setHasPin(true);
          onLocationChange({ lat: pos.lat, lng: pos.lng, address: addr });
        });
      }

      map.setView([lat, lng], Math.max(map.getZoom(), 15));

      if (!skipGeocode) {
        const addr = await reverseGeocode(lat, lng);
        setAddress(addr);
        onLocationChange({ lat, lng, address: addr });
      } else {
        onLocationChange({ lat, lng, address });
      }
      setHasPin(true);
    },
    [onLocationChange, reverseGeocode, address]
  );

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const center: [number, number] = initialLocation
      ? [initialLocation.lat, initialLocation.lng]
      : DEFAULT_CENTER;

    const map = L.map(mapRef.current, {
      center,
      zoom: initialLocation ? 16 : DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Add initial marker if location exists
    if (initialLocation) {
      const marker = L.marker([initialLocation.lat, initialLocation.lng], {
        draggable: true,
      }).addTo(map);
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        const addr = await reverseGeocode(pos.lat, pos.lng);
        setAddress(addr);
        setHasPin(true);
        onLocationChange({ lat: pos.lat, lng: pos.lng, address: addr });
      });
      markerRef.current = marker;
    }

    // Click to place pin
    map.on('click', async (e: L.LeafletMouseEvent) => {
      await updateMarker(e.latlng.lat, e.latlng.lng);
    });

    // Fix map rendering in hidden/dynamic containers
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=tz`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      if (results.length > 0) {
        const { lat, lon, display_name } = results[0];
        setAddress(display_name);
        await updateMarker(parseFloat(lat), parseFloat(lon), true);
        onLocationChange({ lat: parseFloat(lat), lng: parseFloat(lon), address: display_name });
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await updateMarker(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MapPin className="w-4 h-4 text-primary" />
          Shop / Business Location
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search location in Tanzania..."
            className="pr-10 bg-secondary/50 h-10"
          />
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={searching}
          className="h-10 px-3"
        >
          {searching ? '...' : 'Search'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={locating}
          className="h-10 px-3"
          title="Use current location"
        >
          <Navigation className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} />
        </Button>
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        className="w-full h-64 sm:h-72 rounded-xl border border-border overflow-hidden z-0"
      />

      {/* Status / address display */}
      {hasPin && address ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-foreground leading-relaxed">{address}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tap on the map or search to set your shop location. You can drag the pin to adjust.
        </p>
      )}
    </div>
  );
};
