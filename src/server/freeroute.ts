/**
 * Server-side FreeRoute Maps, Geocoding & Routing Engine (api.maps.freeroute.org)
 * Connects securely via process.env.FREEMAPROUTE_API_KEY on the backend so keys never reach the browser.
 * Includes resilient South African OSM Nominatim & OSRM corridor support whenever a query
 * falls outside FreeRoute's primary regional graph index.
 */

export type HazardKind = 'pothole' | 'accident' | 'traffic' | 'alert';

export interface GeocodePlace {
  label: string;
  shortLabel: string;
  lat: number;
  lon: number;
  countryCode?: string;
  provinceName?: string;
  cityName?: string;
  type?: string;
  source: 'freeroute' | 'osm-za';
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
}

export interface ComputedRoute {
  source: 'freeroute' | 'freeroute-za-corridor';
  profile: 'driving-car' | 'foot-walking';
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lat, lon] pairs ready for Leaflet polyline
  bbox?: [number, number, number, number];
  steps: RouteStep[];
}

export interface MapHazardPin {
  id: string;
  kind: HazardKind;
  title: string;
  description: string;
  area: string;
  province: string;
  lat: number;
  lon: number;
  severity: 'low' | 'medium' | 'high';
  confirmations: number;
  falseReportCount: number;
  beingSolvedCount: number;
  createdAt: string;
  isUserPinned?: boolean;
}

const FREEROUTE_BASE_URL = 'https://api.maps.freeroute.org';

export function getFreeRouteApiKey(): string | null {
  const raw = process.env.FREEMAPROUTE_API_KEY || process.env.FREEROUTE_API_KEY;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (
    trimmed.length < 10 ||
    trimmed === 'MY_FREEMAPROUTE_API_KEY' ||
    trimmed === 'MY_FREEROUTE_API_KEY'
  ) {
    return null;
  }
  return trimmed;
}

export function isFreeRouteConfigured(): boolean {
  return Boolean(getFreeRouteApiKey());
}

export async function checkFreeRouteHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  provider: string;
  baseUrl: string;
  keyPrefix: string | null;
}> {
  const key = getFreeRouteApiKey();
  let reachable = false;
  try {
    const res = await fetch(`${FREEROUTE_BASE_URL}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    reachable = res.ok;
  } catch {
    reachable = false;
  }
  return {
    configured: Boolean(key),
    reachable,
    provider: 'FreeRoute Maps API',
    baseUrl: FREEROUTE_BASE_URL,
    keyPrefix: key ? `${key.slice(0, 8)}...` : null,
  };
}

function isInSouthAfricaBounds(lat: number, lon: number): boolean {
  return lat >= -35.5 && lat <= -21.8 && lon >= 16.0 && lon <= 33.5;
}

function formatShortPlaceLabel(full: string): string {
  const parts = full
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  return `${parts[0]}, ${parts[1]}`;
}

export async function geocodePlaces(query: string, limit = 6): Promise<GeocodePlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const key = getFreeRouteApiKey();
  const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 10);
  const results: GeocodePlace[] = [];

  // 1. Primary: Query FreeRoute Geocoding API (/v1/geocode/search)
  if (key) {
    try {
      const params = new URLSearchParams({ q, limit: String(safeLimit) });
      const frRes = await fetch(`${FREEROUTE_BASE_URL}/v1/geocode/search?${params.toString()}`, {
        headers: {
          'X-API-Key': key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (frRes.ok) {
        const data: any = await frRes.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        for (const feat of features) {
          const coords = feat?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          const lon = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const props = feat?.properties || {};
          const label = String(props.label || props.name || q);
          results.push({
            label,
            shortLabel: formatShortPlaceLabel(label),
            lat,
            lon,
            countryCode: props.countrycode || props.country_a || undefined,
            type: props.type || undefined,
            source: 'freeroute',
          });
        }
      }
    } catch (err: any) {
      console.warn('[FreeRoute Geocode] Notice:', err?.message || err);
    }
  }

  // Check if FreeRoute returned South African results; if not, enrich with ZA OpenStreetMap lookup
  const hasSouthAfricaMatch = results.some(
    (r) => r.countryCode === 'ZAF' || r.countryCode === 'ZA' || isInSouthAfricaBounds(r.lat, r.lon)
  );

  if (!hasSouthAfricaMatch) {
    try {
      const nomParams = new URLSearchParams({
        format: 'jsonv2',
        countrycodes: 'za',
        limit: String(safeLimit),
        q,
      });
      const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?${nomParams.toString()}`, {
        headers: {
          'User-Agent': 'DriverPingSA/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (nomRes.ok) {
        const nomData: any = await nomRes.json();
        if (Array.isArray(nomData)) {
          const zaPlaces: GeocodePlace[] = nomData
            .map((item: any) => {
              const lat = Number(item.lat);
              const lon = Number(item.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              const label = String(item.display_name || item.name || q);
              return {
                label,
                shortLabel: formatShortPlaceLabel(label),
                lat,
                lon,
                countryCode: 'ZAF',
                type: item.type || item.category || undefined,
                source: 'osm-za' as const,
              };
            })
            .filter(Boolean) as GeocodePlace[];

          // Prefer South African matches first, followed by any FreeRoute global matches
          return [...zaPlaces, ...results].slice(0, safeLimit);
        }
      }
    } catch (err: any) {
      console.warn('[ZA Geocode Enrichment] Notice:', err?.message || err);
    }
  }

  return results.slice(0, safeLimit);
}

export async function reverseGeocodePoint(lat: number, lon: number): Promise<GeocodePlace | null> {
  const key = getFreeRouteApiKey();

  if (key) {
    try {
      const params = new URLSearchParams({ lon: String(lon), lat: String(lat) });
      const frRes = await fetch(`${FREEROUTE_BASE_URL}/v1/geocode/reverse?${params.toString()}`, {
        headers: {
          'X-API-Key': key,
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (frRes.ok) {
        const data: any = await frRes.json();
        const feat = Array.isArray(data?.features) ? data.features[0] : null;
        if (feat?.geometry?.coordinates) {
          const props = feat.properties || {};
          const label = String(props.label || props.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
          const provinceName = props.region || props.macroregion || props.state || undefined;
          const cityName =
            props.locality || props.localadmin || props.county || props.city || undefined;
          return {
            label,
            shortLabel: formatShortPlaceLabel(label),
            lat: Number(feat.geometry.coordinates[1]),
            lon: Number(feat.geometry.coordinates[0]),
            countryCode: props.countrycode || undefined,
            provinceName: provinceName ? String(provinceName) : undefined,
            cityName: cityName ? String(cityName) : undefined,
            source: 'freeroute',
          };
        }
      }
    } catch {
      // Fallback below
    }
  }

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      lat: String(lat),
      lon: String(lon),
    });
    const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        'User-Agent': 'DriverPingSA/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (nomRes.ok) {
      const item: any = await nomRes.json();
      if (item?.display_name) {
        const addr = item.address || {};
        const provinceName = addr.state || addr.province || addr.region || undefined;
        const cityName =
          addr.city ||
          addr.town ||
          addr.municipality ||
          addr.suburb ||
          addr.village ||
          addr.county ||
          undefined;
        return {
          label: String(item.display_name),
          shortLabel: formatShortPlaceLabel(String(item.display_name)),
          lat,
          lon,
          countryCode: item?.address?.country_code?.toUpperCase() || 'ZAF',
          provinceName: provinceName ? String(provinceName) : undefined,
          cityName: cityName ? String(cityName) : undefined,
          source: 'osm-za',
        };
      }
    }
  } catch {
    // Ignore
  }

  return {
    label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    shortLabel: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    lat,
    lon,
    source: 'osm-za',
  };
}

export async function computeRoute(params: {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  profile?: 'driving-car' | 'foot-walking';
}): Promise<ComputedRoute> {
  const { from, to, profile = 'driving-car' } = params;
  const key = getFreeRouteApiKey();

  // 1. Primary: Call FreeRoute Directions API (/v1/directions/{profile})
  if (key) {
    try {
      const frRes = await fetch(`${FREEROUTE_BASE_URL}/v1/directions/${profile}`, {
        method: 'POST',
        headers: {
          'X-API-Key': key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
          instructions: true,
        }),
        signal: AbortSignal.timeout(6500),
      });

      if (frRes.ok) {
        const data: any = await frRes.json();
        const feat = Array.isArray(data?.features) ? data.features[0] : null;
        const rawCoords = feat?.geometry?.coordinates;
        if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
          const coordinates: [number, number][] = rawCoords.map((c: number[]) => [Number(c[1]), Number(c[0])]);
          const segment = feat?.properties?.segments?.[0] || {};
          const summary = feat?.properties?.summary || {};
          const distanceMeters = Number(summary.distance ?? segment.distance ?? 0);
          const durationSeconds = Number(summary.duration ?? segment.duration ?? 0);
          const steps: RouteStep[] = Array.isArray(segment.steps)
            ? segment.steps.map((s: any) => ({
                instruction: String(s.instruction || 'Continue'),
                distanceMeters: Number(s.distance || 0),
                durationSeconds: Number(s.duration || 0),
                name: s.name ? String(s.name) : undefined,
              }))
            : [];

          return {
            source: 'freeroute',
            profile,
            distanceMeters,
            durationSeconds,
            coordinates,
            bbox: Array.isArray(data.bbox) && data.bbox.length === 4 ? data.bbox : undefined,
            steps,
          };
        }
      }
    } catch (err: any) {
      console.warn('[FreeRoute Directions] Notice:', err?.message || err);
    }
  }

  // 2. Fallback for South African / outside-graph corridors using OSRM road network
  const osrmProfile = profile === 'foot-walking' ? 'foot' : 'driving';
  const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const osrmRes = await fetch(osrmUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (!osrmRes.ok) {
    throw new Error(`Unable to compute route (${osrmRes.status})`);
  }

  const osrmData: any = await osrmRes.json();
  const route = Array.isArray(osrmData?.routes) ? osrmData.routes[0] : null;
  if (!route?.geometry?.coordinates) {
    throw new Error('No drivable road route found between the selected locations.');
  }

  const coordinates: [number, number][] = route.geometry.coordinates.map((c: number[]) => [
    Number(c[1]),
    Number(c[0]),
  ]);

  const rawSteps = Array.isArray(route?.legs?.[0]?.steps) ? route.legs[0].steps : [];
  const steps: RouteStep[] = rawSteps.map((s: any) => {
    const type = s?.maneuver?.type || 'continue';
    const mod = s?.maneuver?.modifier ? ` ${s.maneuver.modifier}` : '';
    const road = s?.name ? ` onto ${s.name}` : '';
    const instruction =
      type === 'depart'
        ? `Depart${road || ' on route'}`
        : type === 'arrive'
          ? 'Arrive at destination'
          : `${type.charAt(0).toUpperCase() + type.slice(1)}${mod}${road}`;
    return {
      instruction,
      distanceMeters: Number(s.distance || 0),
      durationSeconds: Number(s.duration || 0),
      name: s.name ? String(s.name) : undefined,
    };
  });

  return {
    source: 'freeroute-za-corridor',
    profile,
    distanceMeters: Number(route.distance || 0),
    durationSeconds: Number(route.duration || 0),
    coordinates,
    steps,
  };
}

export interface NetworkLocationResult {
  lat: number;
  lon: number;
  area: string;
  city?: string;
  region?: string;
  countryCode?: string;
  source: 'network-ip';
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (!clean) return true;
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return true;
  if (clean.startsWith('10.') || clean.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) return true;
  if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80:')) return true;
  return false;
}

export async function resolveNetworkLocation(clientIp?: string): Promise<NetworkLocationResult> {
  const cleanIp = clientIp ? clientIp.replace(/^::ffff:/, '').trim() : '';
  const queryIp = cleanIp && !isPrivateOrLoopbackIp(cleanIp) ? cleanIp : '';

  // 1. Primary: ipwho.is (HTTPS, no API key required)
  try {
    const url = queryIp
      ? `https://ipwho.is/${encodeURIComponent(queryIp)}`
      : 'https://ipwho.is/';
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'DriverPingSA/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const lat = Number(data?.latitude);
      const lon = Number(data?.longitude);
      if (data?.success !== false && Number.isFinite(lat) && Number.isFinite(lon)) {
        const areaParts = [data.city, data.region || data.country].filter(Boolean);
        return {
          lat,
          lon,
          area: areaParts.length > 0 ? areaParts.join(', ') : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          city: data.city ? String(data.city) : undefined,
          region: data.region ? String(data.region) : undefined,
          countryCode: data.country_code ? String(data.country_code) : undefined,
          source: 'network-ip',
        };
      }
    }
  } catch (err: any) {
    console.warn('[Network Location] ipwho.is notice:', err?.message || err);
  }

  // 2. Fallback: ipapi.co (HTTPS)
  try {
    const url = queryIp
      ? `https://ipapi.co/${encodeURIComponent(queryIp)}/json/`
      : 'https://ipapi.co/json/';
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'DriverPingSA/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const lat = Number(data?.latitude);
      const lon = Number(data?.longitude);
      if (!data?.error && Number.isFinite(lat) && Number.isFinite(lon)) {
        const areaParts = [data.city, data.region || data.country_name].filter(Boolean);
        return {
          lat,
          lon,
          area: areaParts.length > 0 ? areaParts.join(', ') : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          city: data.city ? String(data.city) : undefined,
          region: data.region ? String(data.region) : undefined,
          countryCode: data.country_code ? String(data.country_code) : undefined,
          source: 'network-ip',
        };
      }
    }
  } catch (err: any) {
    console.warn('[Network Location] ipapi.co notice:', err?.message || err);
  }

  throw new Error('Could not determine current location from network.');
}


