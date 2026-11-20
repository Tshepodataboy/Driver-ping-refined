import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Layers,
  Navigation,
  LayoutGrid,
  MapPin,
  AlertTriangle,
  Siren,
  Car,
  X,
  Plus,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  ThumbsUp,
  LocateFixed,
  Wifi,
} from 'lucide-react';
import {
  getClientVoterId,
  getStoredHazardVotes,
  saveStoredHazardVote,
  replaceAllStoredHazardVotes,
  EMPTY_HAZARD_VOTE,
  HazardAnalysisStatus,
  HazardVoteSelection,
} from '../utils/hazardVotes.js';

export type HazardKind = 'pothole' | 'accident' | 'traffic' | 'alert';

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
  falseReportCount?: number;
  beingSolvedCount?: number;
  createdAt: string;
  isUserPinned?: boolean;
}

interface GeocodePlace {
  label: string;
  shortLabel: string;
  lat: number;
  lon: number;
  provinceName?: string;
  source?: string;
}

interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  name?: string;
}

interface ComputedRoute {
  source: string;
  profile: 'driving-car' | 'foot-walking';
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  steps: RouteStep[];
}

interface LiveRouteMapProps {
  onClose: () => void;
  provinceFilter: string;
  onProvinceFilterChange: (province: string) => void;
  initialHazard?: MapHazardPin | null;
  onHazardsChanged?: () => void;
}

const PROVINCE_VIEWPORTS: Record<string, { label: string; center: [number, number]; zoom: number }> = {
  ALL: { label: 'All RSA', center: [-28.8, 24.8], zoom: 5 },
  GP: { label: 'GP', center: [-26.14, 28.08], zoom: 10 },
  WC: { label: 'WC', center: [-33.92, 18.49], zoom: 11 },
  KZN: { label: 'KZN', center: [-29.82, 30.98], zoom: 11 },
  EC: { label: 'EC', center: [-33.95, 25.58], zoom: 11 },
  FS: { label: 'FS', center: [-29.12, 26.2], zoom: 11 },
  MP: { label: 'MP', center: [-25.47, 30.85], zoom: 10 },
  LP: { label: 'LP', center: [-23.91, 29.45], zoom: 10 },
  NW: { label: 'NW', center: [-25.67, 27.24], zoom: 10 },
  NC: { label: 'NC', center: [-28.73, 24.76], zoom: 10 },
};

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '1 min';
  const totalMins = Math.max(1, Math.round(seconds / 60));
  if (totalMins < 60) return `${totalMins} min`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

function timeAgo(iso: string): string {
  const diffMins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const hrs = Math.round(diffMins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function resolveProvinceFromName(name?: string, fallback?: string): string {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gauteng')) return 'GP';
  if (lower.includes('western cape')) return 'WC';
  if (lower.includes('kwazulu')) return 'KZN';
  if (lower.includes('eastern cape')) return 'EC';
  if (lower.includes('free state')) return 'FS';
  if (lower.includes('mpumalanga')) return 'MP';
  if (lower.includes('limpopo')) return 'LP';
  if (lower.includes('north west')) return 'NW';
  if (lower.includes('northern cape')) return 'NC';
  return fallback && fallback !== 'ALL' ? fallback : 'GP';
}

// Compute crisp metric scale labels matching the reference map scale bar
function computeScaleLabels(map: L.Map): { mid: string; max: string; widthPx: number } {
  const size = map.getSize();
  const y = Math.round(size.y / 2);
  const p1 = map.containerPointToLatLng([0, y]);
  const p2 = map.containerPointToLatLng([110, y]);
  const rawMeters = p1.distanceTo(p2);
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  let chosen = steps[steps.length - 1];
  for (const s of steps) {
    if (s >= rawMeters * 0.75) {
      chosen = s;
      break;
    }
  }
  const widthPx = Math.max(76, Math.min(130, Math.round((chosen / Math.max(rawMeters, 1)) * 110)));
  const fmt = (m: number) => (m >= 1000 ? `${m / 1000} km` : `${m} m`);
  return {
    mid: fmt(chosen / 2),
    max: fmt(chosen),
    widthPx,
  };
}

// Dark charcoal circular teardrop pins displaying the incident icon
function buildHazardIcon(kind: HazardKind, selected: boolean): L.DivIcon {
  const accent: Record<HazardKind, string> = {
    pothole: '#FBBF24',
    accident: '#F87171',
    traffic: '#60A5FA',
    alert: '#C084FC',
  };
  const iconColor = accent[kind] || accent.alert;
  const size = selected ? 38 : 32;
  const iconPx = selected ? 18 : 15;
  const border = selected ? '2.5px solid #111827' : '2px solid #FFFFFF';
  const shadow = selected
    ? '0 0 0 4px rgba(137,243,88,0.65), 0 6px 14px rgba(0,0,0,0.34)'
    : '0 3px 10px rgba(0,0,0,0.28)';

  const svgByKind: Record<HazardKind, string> = {
    accident:
      '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.9 4.9.7.7"/><path d="M12 12v6"/>',
    pothole:
      '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    traffic:
      '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    alert:
      '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  };

  const innerPaths = svgByKind[kind] || svgByKind.alert;
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconPx}" height="${iconPx}" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;transform:rotate(45deg);">${innerPaths}</svg>`;

  return L.divIcon({
    className: 'dp-hazard-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px 9999px 9999px 4px;transform:rotate(-45deg);background:#1C241E;border:${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;">${iconSvg}</div>`,
  });
}

function buildEndpointIcon(kind: 'origin' | 'dest'): L.DivIcon {
  if (kind === 'origin') {
    return L.divIcon({
      className: 'dp-route-origin',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      html: `<div style="width:22px;height:22px;border-radius:9999px;background:rgba(26,115,232,0.24);display:flex;align-items:center;justify-content:center;"><div style="width:12px;height:12px;border-radius:9999px;background:#1A73E8;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div></div>`,
    });
  }
  return L.divIcon({
    className: 'dp-route-dest',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    html: `<div style="width:28px;height:28px;border-radius:9999px 9999px 9999px 4px;transform:rotate(-45deg);background:#D93025;border:2.5px solid #FFFFFF;box-shadow:0 4px 12px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:11px;font-family:system-ui,sans-serif;">B</span></div>`,
  });
}

export function LiveRouteMap({
  onClose,
  provinceFilter,
  onProvinceFilterChange,
  initialHazard = null,
  onHazardsChanged,
}: LiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hazardLayerRef = useRef<L.LayerGroup | null>(null);
  const pendingPinLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const streetTileLayerRef = useRef<L.TileLayer | null>(null);
  const topoTileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [freeRouteOnline, setFreeRouteOnline] = useState<boolean | null>(null);
  const [isTopoMode, setIsTopoMode] = useState(false);
  const [scaleBar, setScaleBar] = useState<{ mid: string; max: string; widthPx: number }>({
    mid: '50 km',
    max: '100 km',
    widthPx: 98,
  });

  // Maps-only GPS permission state
  const [geoPermission, setGeoPermission] = useState<'granted' | 'prompt' | 'denied' | 'unsupported'>('prompt');
  const [userGeoCoords, setUserGeoCoords] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Filters & Hazards
  const [kindFilter, setKindFilter] = useState<'all' | 'pothole' | 'accident' | 'traffic'>('all');
  const [hazards, setHazards] = useState<MapHazardPin[]>([]);
  const [selectedHazard, setSelectedHazard] = useState<MapHazardPin | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [hazardVotes, setHazardVotes] = useState<Record<string, HazardVoteSelection>>(() =>
    getStoredHazardVotes()
  );

  // Floating Popovers & Drawers
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [isAlertListExpanded, setIsAlertListExpanded] = useState(false);

  // Top Search Bar State
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [areaSuggestions, setAreaSuggestions] = useState<GeocodePlace[]>([]);
  const [isSearchingArea, setIsSearchingArea] = useState(false);

  // Route Planner State (FreeRoute)
  const [originQuery, setOriginQuery] = useState('Your location');
  const [destQuery, setDestQuery] = useState('');
  const [originPlace, setOriginPlace] = useState<GeocodePlace | null>(null);
  const [destPlace, setDestPlace] = useState<GeocodePlace | null>(null);
  const [originSuggestions, setOriginSuggestions] = useState<GeocodePlace[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GeocodePlace[]>([]);
  const [activeRouteField, setActiveRouteField] = useState<'origin' | 'dest' | null>(null);
  const [routeProfile, setRouteProfile] = useState<'driving-car' | 'foot-walking'>('driving-car');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<ComputedRoute | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  // Tap-to-Pin / Type / Network Hazard Mode
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinLocationMode, setPinLocationMode] = useState<'map' | 'type' | 'network'>('map');
  const [pendingPinCoords, setPendingPinCoords] = useState<{
    lat: number;
    lon: number;
    area: string;
    province?: string;
  } | null>(null);
  const [pinLocationQuery, setPinLocationQuery] = useState('');
  const [pinLocationSuggestions, setPinLocationSuggestions] = useState<GeocodePlace[]>([]);
  const [isSearchingPinLocation, setIsSearchingPinLocation] = useState(false);
  const [isDetectingPinNetwork, setIsDetectingPinNetwork] = useState(false);
  const [pinKind, setPinKind] = useState<'pothole' | 'accident' | 'traffic'>('pothole');
  const [pinTitle, setPinTitle] = useState('');
  const [pinDescription, setPinDescription] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const isPinModeRef = useRef(isPinMode);
  useEffect(() => {
    isPinModeRef.current = isPinMode;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = isPinMode ? 'crosshair' : '';
    }
  }, [isPinMode]);

  // 1. Check FreeRoute server connectivity
  useEffect(() => {
    let active = true;
    fetch('/api/map/status')
      .then((r) => r.json())
      .then((data) => {
        if (active) setFreeRouteOnline(Boolean(data?.configured));
      })
      .catch(() => {
        if (active) setFreeRouteOnline(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const initial = PROVINCE_VIEWPORTS[provinceFilter] || PROVINCE_VIEWPORTS.ALL;
    const map = L.map(container, {
      center: initial.center,
      zoom: initial.zoom,
      zoomControl: false,
      attributionControl: false,
    });

    const streetLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '&copy; Esri · FreeRoute',
      }
    ).addTo(map);

    const topoLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '&copy; Esri Topo · FreeRoute',
      }
    );

    const osmFallback = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      subdomains: 'abc',
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    });

    streetLayer.on('tileerror', () => {
      if (!map.hasLayer(osmFallback)) {
        osmFallback.addTo(map);
      }
    });

    const hazardLayer = L.layerGroup().addTo(map);
    const pendingPinLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const userLocationLayer = L.layerGroup().addTo(map);

    const updateScale = () => {
      setScaleBar(computeScaleLabels(map));
    };
    map.on('zoomend moveend', updateScale);

    map.on('click', async (ev: L.LeafletMouseEvent) => {
      setShowLayersPanel(false);
      setShowToolsMenu(false);
      setActiveRouteField(null);
      setAreaSuggestions([]);

      if (!isPinModeRef.current) return;
      const { lat, lng } = ev.latlng;
      setPinLocationMode('map');
      setPinLocationSuggestions([]);
      setPendingPinCoords({
        lat,
        lon: lng,
        area: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
      setPinError(null);
      try {
        const res = await fetch(`/api/map/reverse?lat=${lat}&lon=${lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.place?.shortLabel) {
            setPendingPinCoords({
              lat,
              lon: lng,
              area: data.place.shortLabel,
              province: resolveProvinceFromName(data.place.provinceName),
            });
          }
        }
      } catch {
        // Keep coordinate fallback string
      }
    });

    mapRef.current = map;
    hazardLayerRef.current = hazardLayer;
    pendingPinLayerRef.current = pendingPinLayer;
    routeLayerRef.current = routeLayer;
    userLocationLayerRef.current = userLocationLayer;
    streetTileLayerRef.current = streetLayer;
    topoTileLayerRef.current = topoLayer;
    setScaleBar(computeScaleLabels(map));
    setMapReady(true);

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
      setScaleBar(computeScaleLabels(map));
    }, 150);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize();
          })
        : null;
    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      hazardLayerRef.current = null;
      pendingPinLayerRef.current = null;
      routeLayerRef.current = null;
      userLocationLayerRef.current = null;
      streetTileLayerRef.current = null;
      topoTileLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 2a. Switch between Street (2D) & Topo Terrain (3D) map layers
  useEffect(() => {
    const map = mapRef.current;
    const street = streetTileLayerRef.current;
    const topo = topoTileLayerRef.current;
    if (!map || !street || !topo || !mapReady) return;

    if (isTopoMode) {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(topo)) topo.addTo(map);
      topo.bringToBack();
    } else {
      if (map.hasLayer(topo)) map.removeLayer(topo);
      if (!map.hasLayer(street)) street.addTo(map);
      street.bringToBack();
    }
  }, [isTopoMode, mapReady]);

  // 2b. Check browser geolocation permission ONLY while Maps is open
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPermission('unsupported');
      return;
    }

    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      if (cancelled || !permStatus) return;
      const state = permStatus.state;
      setGeoPermission(state);
      if (state !== 'granted') {
        setUserGeoCoords(null);
      }
    };

    const initPermissionCheck = async () => {
      if (!navigator.permissions?.query) return;
      try {
        permStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (cancelled) return;
        setGeoPermission(permStatus.state);
        permStatus.addEventListener('change', handlePermissionChange);

        if (permStatus.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const lat = pos.coords.latitude;
              const lon = pos.coords.longitude;
              setUserGeoCoords({ lat, lon, accuracy: pos.coords.accuracy });
              setOriginPlace((prev) =>
                prev ?? { label: 'Your location', shortLabel: 'Your location', lat, lon }
              );
            },
            () => {
              // Ignore passive read failure
            },
            { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
          );
        }
      } catch {
        // Fallback where Permissions API omits geolocation
      }
    };

    void initPermissionCheck();

    return () => {
      cancelled = true;
      permStatus?.removeEventListener('change', handlePermissionChange);
    };
  }, []);

  // 2c. Render live blue GPS dot when user location is granted for Maps
  useEffect(() => {
    const layer = userLocationLayerRef.current;
    if (!layer || !mapReady) return;
    layer.clearLayers();
    if (!userGeoCoords) return;

    if (userGeoCoords.accuracy && userGeoCoords.accuracy < 2000) {
      L.circle([userGeoCoords.lat, userGeoCoords.lon], {
        radius: Math.min(userGeoCoords.accuracy, 400),
        color: '#1A73E8',
        weight: 1,
        opacity: 0.35,
        fillColor: '#1A73E8',
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(layer);
    }

    L.marker([userGeoCoords.lat, userGeoCoords.lon], {
      icon: buildEndpointIcon('origin'),
      interactive: false,
    }).addTo(layer);
  }, [userGeoCoords, mapReady]);

  // 3. Fly to selected province when filter changes (unless focused on an initial hazard)
  const initialHazardAppliedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (initialHazard && !initialHazardAppliedRef.current) {
      initialHazardAppliedRef.current = true;
      setSelectedHazard(initialHazard);
      map.flyTo([initialHazard.lat, initialHazard.lon], 14, { duration: 0.7 });
      return;
    }

    const viewport = PROVINCE_VIEWPORTS[provinceFilter] || PROVINCE_VIEWPORTS.ALL;
    map.flyTo(viewport.center, viewport.zoom, { duration: 0.7 });
  }, [provinceFilter, mapReady, initialHazard]);

  // 4. Load live hazards from server
  const fetchHazards = async () => {
    try {
      const params = new URLSearchParams({
        province: provinceFilter || 'ALL',
        kind: kindFilter,
        voterId: getClientVoterId(),
      });
      const res = await fetch(`/api/map/hazards?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setHazards(Array.isArray(data?.hazards) ? data.hazards : []);
        if (data?.userVotes && typeof data.userVotes === 'object') {
          setHazardVotes(replaceAllStoredHazardVotes(data.userVotes));
        }
      }
    } catch {
      // Ignore transient errors
    }
  };

  useEffect(() => {
    fetchHazards();
  }, [provinceFilter, kindFilter]);

  // 5. Render hazard markers onto Leaflet layer
  useEffect(() => {
    const layer = hazardLayerRef.current;
    if (!layer || !mapReady) return;
    layer.clearLayers();

    for (const h of hazards) {
      const isSelected = selectedHazard?.id === h.id;
      const marker = L.marker([h.lat, h.lon], {
        icon: buildHazardIcon(h.kind, isSelected),
      });
      marker.on('click', () => {
        setSelectedHazard(h);
        setShowLayersPanel(false);
        setShowToolsMenu(false);
        setShowRoutePlanner(false);
        setIsAlertListExpanded(false);
      });
      marker.addTo(layer);
    }
  }, [hazards, selectedHazard, mapReady]);

  // 5b. Render live preview pin marker whenever user places/picks a new pin location
  useEffect(() => {
    const layer = pendingPinLayerRef.current;
    if (!layer || !mapReady) return;
    layer.clearLayers();

    if (!pendingPinCoords) return;

    L.circleMarker([pendingPinCoords.lat, pendingPinCoords.lon], {
      radius: 22,
      color: '#89F358',
      weight: 2.5,
      opacity: 0.9,
      fillColor: '#89F358',
      fillOpacity: 0.22,
      interactive: false,
    }).addTo(layer);

    const previewMarker = L.marker([pendingPinCoords.lat, pendingPinCoords.lon], {
      icon: buildHazardIcon(pinKind, true),
      draggable: true,
      zIndexOffset: 1000,
    }).addTo(layer);

    previewMarker.on('dragend', async () => {
      const pos = previewMarker.getLatLng();
      setPendingPinCoords({
        lat: pos.lat,
        lon: pos.lng,
        area: `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`,
      });
      try {
        const res = await fetch(`/api/map/reverse?lat=${pos.lat}&lon=${pos.lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.place?.shortLabel) {
            setPendingPinCoords({
              lat: pos.lat,
              lon: pos.lng,
              area: data.place.shortLabel,
              province: resolveProvinceFromName(data.place.provinceName),
            });
          }
        }
      } catch {
        // Keep coordinate fallback
      }
    });
  }, [pendingPinCoords, pinKind, mapReady]);

  // 6. Render active route polyline & endpoints
  useEffect(() => {
    const layer = routeLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map || !mapReady) return;
    layer.clearLayers();

    if (!activeRoute || activeRoute.coordinates.length < 2) return;

    L.polyline(activeRoute.coordinates, {
      color: '#1E3A8A',
      weight: 8,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);

    const line = L.polyline(activeRoute.coordinates, {
      color: '#1D4ED8',
      weight: 5,
      opacity: 0.98,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layer);

    const start = activeRoute.coordinates[0];
    const end = activeRoute.coordinates[activeRoute.coordinates.length - 1];
    L.marker(start, { icon: buildEndpointIcon('origin') }).addTo(layer);
    L.marker(end, { icon: buildEndpointIcon('dest') }).addTo(layer);

    map.fitBounds(line.getBounds(), {
      paddingTopLeft: [40, 140],
      paddingBottomRight: [40, 210],
      maxZoom: 15,
    });
  }, [activeRoute, mapReady]);

  // 7a. Debounced Top "Map area" search suggestions
  useEffect(() => {
    const q = areaSearchQuery.trim();
    if (q.length < 2) {
      setAreaSuggestions([]);
      setIsSearchingArea(false);
      return;
    }
    setIsSearchingArea(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setAreaSuggestions(Array.isArray(data?.places) ? data.places : []);
        }
      } catch {
        setAreaSuggestions([]);
      } finally {
        setIsSearchingArea(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [areaSearchQuery]);

  // 7b. Debounced Route Origin/Dest autocomplete
  useEffect(() => {
    if (activeRouteField !== 'origin') return;
    const q = originQuery.trim();
    if (
      q.length < 2 ||
      q.toLowerCase() === 'your location' ||
      (originPlace && originPlace.shortLabel === originQuery)
    ) {
      setOriginSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setOriginSuggestions(Array.isArray(data?.places) ? data.places : []);
        }
      } catch {
        setOriginSuggestions([]);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [originQuery, activeRouteField, originPlace]);

  useEffect(() => {
    if (activeRouteField !== 'dest') return;
    const q = destQuery.trim();
    if (q.length < 2 || (destPlace && destPlace.shortLabel === destQuery)) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setDestSuggestions(Array.isArray(data?.places) ? data.places : []);
        }
      } catch {
        setDestSuggestions([]);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [destQuery, activeRouteField, destPlace]);

  // 7c. Debounced autocomplete for typed Add-Pin location search
  useEffect(() => {
    if (!isPinMode || pinLocationMode !== 'type') {
      setPinLocationSuggestions([]);
      setIsSearchingPinLocation(false);
      return;
    }
    const q = pinLocationQuery.trim();
    if (q.length < 2 || (pendingPinCoords && pendingPinCoords.area === pinLocationQuery)) {
      setPinLocationSuggestions([]);
      setIsSearchingPinLocation(false);
      return;
    }
    setIsSearchingPinLocation(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setPinLocationSuggestions(Array.isArray(data?.places) ? data.places : []);
        }
      } catch {
        setPinLocationSuggestions([]);
      } finally {
        setIsSearchingPinLocation(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [pinLocationQuery, pinLocationMode, isPinMode, pendingPinCoords]);

  // Resolve "Your location" via browser GPS (maps-only permission; graceful fallback to map center)
  const resolveCurrentOrigin = async (): Promise<GeocodePlace> => {
    if (originPlace) return originPlace;
    if (userGeoCoords) {
      return {
        label: 'Your location',
        shortLabel: 'Your location',
        lat: userGeoCoords.lat,
        lon: userGeoCoords.lon,
      };
    }

    if (
      typeof navigator !== 'undefined' &&
      navigator.geolocation &&
      geoPermission !== 'denied' &&
      geoPermission !== 'unsupported'
    ) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 4000,
            maximumAge: 30000,
          });
        });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGeoPermission('granted');
        setUserGeoCoords({ lat, lon, accuracy: pos.coords.accuracy });
        return { label: 'Your location', shortLabel: 'Your location', lat, lon };
      } catch (err: any) {
        if (err?.code === 1) {
          setGeoPermission('denied');
        }
      }
    }

    const center = mapRef.current?.getCenter();
    if (center) {
      return {
        label: 'Your location',
        shortLabel: 'Your location',
        lat: center.lat,
        lon: center.lng,
      };
    }
    return { label: 'Johannesburg, GP', shortLabel: 'Johannesburg', lat: -26.2041, lon: 28.0473 };
  };

  const calculateRouteBetween = async (
    overrideOrigin?: GeocodePlace | null,
    overrideDest?: GeocodePlace | null,
    overrideProfile?: 'driving-car' | 'foot-walking'
  ) => {
    setRouteError(null);
    setActiveRouteField(null);
    setIsCalculatingRoute(true);

    try {
      let resolvedOrigin = overrideOrigin ?? originPlace;
      let resolvedDest = overrideDest ?? destPlace;

      if (!resolvedOrigin) {
        if (originQuery.trim().toLowerCase() === 'your location' || originQuery.trim().length < 2) {
          resolvedOrigin = await resolveCurrentOrigin();
          setOriginPlace(resolvedOrigin);
          if (!originQuery.trim()) setOriginQuery('Your location');
        } else {
          const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(originQuery.trim())}&limit=1`);
          const data = await res.json();
          if (data?.places?.[0]) {
            resolvedOrigin = data.places[0];
            setOriginPlace(resolvedOrigin);
            setOriginQuery(resolvedOrigin!.shortLabel);
          }
        }
      }

      if (!resolvedDest && destQuery.trim().length >= 2) {
        const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(destQuery.trim())}&limit=1`);
        const data = await res.json();
        if (data?.places?.[0]) {
          resolvedDest = data.places[0];
          setDestPlace(resolvedDest);
          setDestQuery(resolvedDest!.shortLabel);
        }
      }

      if (!resolvedOrigin || !resolvedDest) {
        setRouteError('Choose a destination to calculate a route.');
        return;
      }

      const routeRes = await fetch('/api/map/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: { lat: resolvedOrigin.lat, lon: resolvedOrigin.lon },
          to: { lat: resolvedDest.lat, lon: resolvedDest.lon },
          profile: overrideProfile || routeProfile,
        }),
      });
      const routeData = await routeRes.json();
      if (!routeRes.ok || !routeData?.route) {
        setRouteError(routeData?.error || 'Could not find a road route between these points.');
        return;
      }

      setActiveRoute(routeData.route);
      setSelectedHazard(null);
      setShowRoutePlanner(false);
      setIsAlertListExpanded(false);
      setShowSteps(false);
    } catch (err: any) {
      setRouteError(err?.message || 'Route calculation failed.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleUseMyLocation = () => {
    setRouteError(null);
    setShowToolsMenu(false);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPermission('unsupported');
      setRouteError('Location is not supported in this browser. Type a suburb or city.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGeoPermission('granted');
        setUserGeoCoords({ lat, lon, accuracy: pos.coords.accuracy });
        const place: GeocodePlace = {
          label: 'Your location',
          shortLabel: 'Your location',
          lat,
          lon,
        };
        setOriginPlace(place);
        setOriginQuery('Your location');
        setOriginSuggestions([]);
        mapRef.current?.flyTo([lat, lon], 14, { duration: 0.7 });
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setGeoPermission('denied');
          setRouteError('Location permission is blocked. Allow location for Maps in browser settings or search an area.');
        } else {
          setRouteError('Could not get your GPS location right now. Search a suburb or city instead.');
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
    );
  };

  const handleSelectAreaPlace = (place: GeocodePlace) => {
    setAreaSearchQuery(place.shortLabel);
    setAreaSuggestions([]);
    setDestPlace(place);
    setDestQuery(place.shortLabel);
    mapRef.current?.flyTo([place.lat, place.lon], 13, { duration: 0.7 });
    setShowRoutePlanner(true);
    setSelectedHazard(null);
    setIsAlertListExpanded(false);
  };

  const handleSearchAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = areaSearchQuery.trim();
    if (q.length < 2) return;
    if (areaSuggestions[0]) {
      handleSelectAreaPlace(areaSuggestions[0]);
      return;
    }
    setIsSearchingArea(true);
    try {
      const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(q)}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data?.places?.[0]) {
          handleSelectAreaPlace(data.places[0]);
        }
      }
    } finally {
      setIsSearchingArea(false);
    }
  };

  const handleSwapEndpoints = () => {
    const nextOrigin = destPlace;
    const nextDest = originPlace;
    const nextOriginQuery = destQuery || 'Your location';
    const nextDestQuery = originQuery;
    setOriginPlace(nextOrigin);
    setDestPlace(nextDest);
    setOriginQuery(nextOriginQuery);
    setDestQuery(nextDestQuery);
    if (nextOrigin && nextDest) {
      void calculateRouteBetween(nextOrigin, nextDest);
    }
  };

  const handleClearRoute = () => {
    setActiveRoute(null);
    setOriginPlace(null);
    setDestPlace(null);
    setOriginQuery('Your location');
    setDestQuery('');
    setRouteError(null);
    setShowSteps(false);
  };

  const handleVoteHazardAnalysis = async (
    id: string,
    status: HazardAnalysisStatus
  ) => {
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/map/hazards/${id}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, voterId: getClientVoterId() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.hazard) {
        setHazards((prev) => prev.map((h) => (h.id === id ? data.hazard : h)));
        setSelectedHazard(data.hazard);
        if (data?.userVote) {
          setHazardVotes(saveStoredHazardVote(id, data.userVote));
        }
        onHazardsChanged?.();
      }
    } finally {
      setConfirmingId(null);
    }
  };

  const handleRouteToHazard = (hazard: MapHazardPin) => {
    const dest: GeocodePlace = {
      label: hazard.area,
      shortLabel: hazard.area,
      lat: hazard.lat,
      lon: hazard.lon,
    };
    setDestPlace(dest);
    setDestQuery(hazard.area);
    setSelectedHazard(null);
    void calculateRouteBetween(originPlace, dest);
  };

  const handleSelectTypedPinPlace = (place: GeocodePlace) => {
    setPinError(null);
    setPinLocationQuery(place.shortLabel);
    setPinLocationSuggestions([]);
    setPendingPinCoords({
      lat: place.lat,
      lon: place.lon,
      area: place.shortLabel,
      province: resolveProvinceFromName(place.provinceName, provinceFilter),
    });
    mapRef.current?.flyTo([place.lat, place.lon], 15, { duration: 0.7 });
  };

  const handleSearchTypedPinLocation = async () => {
    const q = pinLocationQuery.trim();
    if (q.length < 2) {
      setPinError('Type a street name, suburb, or city to place the pin.');
      return;
    }
    if (pinLocationSuggestions[0]) {
      handleSelectTypedPinPlace(pinLocationSuggestions[0]);
      return;
    }
    setIsSearchingPinLocation(true);
    setPinError(null);
    try {
      const res = await fetch(`/api/map/geocode?q=${encodeURIComponent(q)}&limit=1`);
      const data = await res.json();
      if (res.ok && data?.places?.[0]) {
        handleSelectTypedPinPlace(data.places[0]);
      } else {
        setPinError('Location not found. Try a street, suburb, or city name.');
      }
    } catch {
      setPinError('Could not look up that location right now.');
    } finally {
      setIsSearchingPinLocation(false);
    }
  };

  const handleUseNetworkLocationForPin = async () => {
    setPinLocationMode('network');
    setPinError(null);
    setIsDetectingPinNetwork(true);

    const applyDetectedCoords = async (lat: number, lon: number, fallbackArea?: string, provinceName?: string) => {
      let area = fallbackArea || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      let resolvedProvince = resolveProvinceFromName(provinceName, provinceFilter);

      try {
        const revRes = await fetch(`/api/map/reverse?lat=${lat}&lon=${lon}`);
        if (revRes.ok) {
          const revData = await revRes.json();
          if (revData?.place?.shortLabel) {
            area = revData.place.shortLabel;
            resolvedProvince = resolveProvinceFromName(revData.place.provinceName, resolvedProvince);
          }
        }
      } catch {
        // Keep initial area string
      }

      setPendingPinCoords({ lat, lon, area, province: resolvedProvince });
      mapRef.current?.flyTo([lat, lon], 15, { duration: 0.7 });
    };

    try {
      // 1. Try browser network/Wi-Fi location first if permitted
      if (
        typeof navigator !== 'undefined' &&
        navigator.geolocation &&
        geoPermission !== 'denied' &&
        geoPermission !== 'unsupported'
      ) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 3500,
              maximumAge: 30000,
            });
          });
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setGeoPermission('granted');
          setUserGeoCoords({ lat, lon, accuracy: pos.coords.accuracy });
          await applyDetectedCoords(lat, lon);
          return;
        } catch (err: any) {
          if (err?.code === 1) {
            setGeoPermission('denied');
          }
        }
      }

      // 2. Network IP geolocation fallback via backend
      const netRes = await fetch('/api/map/network-location');
      const netData = await netRes.json();
      if (!netRes.ok || !netData?.location) {
        setPinError(netData?.error || 'Could not detect your current location through the network.');
        return;
      }
      const { lat, lon, area, provinceName } = netData.location;
      await applyDetectedCoords(Number(lat), Number(lon), area, provinceName);
    } catch {
      setPinError('Could not detect your current location through the network.');
    } finally {
      setIsDetectingPinNetwork(false);
    }
  };

  const handleCancelPinMode = () => {
    setIsPinMode(false);
    setPendingPinCoords(null);
    setPinLocationQuery('');
    setPinLocationSuggestions([]);
    setPinLocationMode('map');
    setPinError(null);
  };

  const handleSubmitHazardPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPinCoords) {
      setPinError('Choose a location first: tap on the map, type a place, or use current network location.');
      return;
    }
    if (pinTitle.trim().length < 2) {
      setPinError('Please add a brief description (at least 2 characters).');
      return;
    }

    setIsSubmittingPin(true);
    setPinError(null);
    try {
      const res = await fetch('/api/map/hazards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: pinKind,
          title: pinTitle.trim(),
          description: pinDescription.trim() || `Reported near ${pendingPinCoords.area}`,
          area: pendingPinCoords.area,
          province:
            pendingPinCoords.province || (provinceFilter === 'ALL' ? 'GP' : provinceFilter),
          lat: pendingPinCoords.lat,
          lon: pendingPinCoords.lon,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data?.error || 'Could not save hazard pin.');
        return;
      }
      if (data?.hazard) {
        setHazards((prev) => [data.hazard, ...prev]);
        setSelectedHazard(data.hazard);
        onHazardsChanged?.();
      }
      setPendingPinCoords(null);
      setPinTitle('');
      setPinDescription('');
      setPinLocationQuery('');
      setPinLocationSuggestions([]);
      setPinLocationMode('map');
      setIsPinMode(false);
    } catch (err: any) {
      setPinError(err?.message || 'Failed to pin hazard.');
    } finally {
      setIsSubmittingPin(false);
    }
  };

  const hasSheetDetail =
    Boolean(isPinMode) ||
    Boolean(pendingPinCoords) ||
    Boolean(selectedHazard) ||
    Boolean(activeRoute) ||
    showRoutePlanner ||
    isAlertListExpanded;

  return (
    <div className="fixed inset-0 pt-14 z-30 flex flex-col bg-[#E8EEF0] text-gray-900 font-sans overflow-hidden">
      {/* FULL-BLEED MAP CANVAS */}
      <div className="relative flex-1 min-h-0 w-full bg-[#E8EEF0]">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* TOP SEARCH PILL + FILTER CHIPS ROW (Exact reference layout) */}
        <div className="absolute top-3 inset-x-0 z-[500] max-w-md mx-auto px-3 pointer-events-none">
          {/* 1. Search Pill */}
          <form
            onSubmit={handleSearchAreaSubmit}
            className="pointer-events-auto h-12 bg-white/95 backdrop-blur-md rounded-full shadow-[0_6px_22px_rgba(0,0,0,0.14)] border border-gray-200/80 px-2 flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-700 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              aria-label="Back to Home"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
            </button>

            <Search className="w-4 h-4 text-gray-800 shrink-0" />

            <input
              type="text"
              value={areaSearchQuery}
              onChange={(e) => setAreaSearchQuery(e.target.value)}
              placeholder="Map area"
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-gray-900 placeholder:text-gray-700 focus:outline-none truncate px-1"
            />

            {isSearchingArea ? (
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin shrink-0 mr-1" />
            ) : areaSearchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setAreaSearchQuery('');
                  setAreaSuggestions([]);
                }}
                className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setShowRoutePlanner((v) => !v);
                setShowLayersPanel(false);
                setShowToolsMenu(false);
                setSelectedHazard(null);
                setIsAlertListExpanded(false);
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                showRoutePlanner
                  ? 'bg-gray-900 text-white'
                  : 'hover:bg-gray-100 text-gray-800'
              }`}
              aria-label="Route and area filters"
              title="Route planner & filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </form>

          {/* Search Autocomplete Dropdown */}
          {areaSuggestions.length > 0 && (
            <div className="pointer-events-auto mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-gray-100">
              {areaSuggestions.map((place, idx) => (
                <button
                  key={`${place.lat}-${place.lon}-${idx}`}
                  type="button"
                  onClick={() => handleSelectAreaPlace(place)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{place.shortLabel}</p>
                    <p className="text-[11px] text-gray-500 truncate">{place.label}</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                    Go
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 2. Horizontal Category Chips Row */}
          <div className="pointer-events-auto mt-2.5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'all', label: 'All', icon: null },
              { id: 'pothole', label: 'Potholes', icon: AlertTriangle },
              { id: 'accident', label: 'Accidents', icon: Siren },
              { id: 'traffic', label: 'Traffic', icon: Car },
            ].map((chip) => {
              const Icon = chip.icon;
              const active = kindFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    setKindFilter(chip.id as 'all' | 'pothole' | 'accident' | 'traffic')
                  }
                  className={`h-9 px-3.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-[0_3px_12px_rgba(0,0,0,0.10)] ${
                    active
                      ? 'bg-white text-gray-950 font-bold border-[1.5px] border-gray-950'
                      : 'bg-[#F0F7FB]/95 hover:bg-white text-gray-800 font-semibold border border-white/90'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 text-gray-800 stroke-[2.2]" />}
                  <span>{chip.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setShowLayersPanel((v) => !v);
                setShowToolsMenu(false);
              }}
              className={`h-9 px-3.5 rounded-full text-xs whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-[0_3px_12px_rgba(0,0,0,0.10)] ${
                provinceFilter !== 'ALL'
                  ? 'bg-white text-gray-950 font-bold border-[1.5px] border-gray-950'
                  : 'bg-[#F0F7FB]/95 hover:bg-white text-gray-800 font-semibold border border-white/90'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-gray-800 stroke-[2.2]" />
              <span>{PROVINCE_VIEWPORTS[provinceFilter]?.label || 'All RSA'}</span>
            </button>
          </div>
        </div>

        {/* TOP-LEFT SCALE BAR + ADD PIN BUTTON + ROUTE ERROR */}
        <div className="absolute top-[116px] left-3.5 z-[460] pointer-events-none flex flex-col items-start gap-2.5">
          {/* Metric Scale Bar matching reference */}
          <div className="flex flex-col select-none">
            <div
              className="flex items-center justify-between text-[10px] font-bold text-gray-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)] mb-0.5"
              style={{ width: `${scaleBar.widthPx}px` }}
            >
              <span>0</span>
              <span>{scaleBar.mid}</span>
              <span>{scaleBar.max}</span>
            </div>
            <div
              className="h-1 flex rounded-full overflow-hidden border border-white/80 shadow-xs"
              style={{ width: `${scaleBar.widthPx}px` }}
            >
              <div className="flex-1 bg-gray-900" />
              <div className="flex-1 bg-white" />
            </div>
          </div>

          {!isPinMode ? (
            <button
              type="button"
              onClick={() => {
                setIsPinMode(true);
                setPinLocationMode('map');
                setPendingPinCoords(null);
                setPinLocationQuery('');
                setPinLocationSuggestions([]);
                setPinError(null);
                setSelectedHazard(null);
                setShowRoutePlanner(false);
                setShowLayersPanel(false);
                setShowToolsMenu(false);
                setIsAlertListExpanded(false);
              }}
              className="pointer-events-auto h-10 px-3 rounded-2xl bg-[#EBF5FA]/95 hover:bg-white active:scale-95 backdrop-blur-md shadow-[0_6px_18px_rgba(0,0,0,0.14)] border border-white/90 text-gray-900 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
              aria-label="Add pin on map"
              title="Tap to add a hazard pin on the map"
            >
              <span className="relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1C241E] text-white shrink-0">
                <MapPin className="w-3 h-3 stroke-[2.2]" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#89F358] text-gray-950 flex items-center justify-center">
                  <Plus className="w-2 h-2 stroke-[3.2]" />
                </span>
              </span>
              <span>Add pin</span>
            </button>
          ) : (
            <div className="pointer-events-auto h-10 bg-gray-950 text-white px-3 rounded-2xl shadow-lg border border-gray-800 flex items-center gap-2 text-xs font-bold">
              <MapPin className="w-3.5 h-3.5 text-[#89F358] shrink-0" />
              <span>{pendingPinCoords ? 'Tap map to move pin' : 'Tap map to place pin'}</span>
              <button
                type="button"
                onClick={handleCancelPinMode}
                className="p-1 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer"
                aria-label="Cancel pin mode"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {routeError && (
            <div className="pointer-events-auto max-w-[270px] bg-white/95 backdrop-blur-md border border-rose-200 rounded-2xl px-3 py-2 shadow-lg flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#941329] leading-snug">
                {routeError}
              </span>
              <button
                type="button"
                onClick={() => setRouteError(null)}
                className="text-gray-400 hover:text-gray-700 cursor-pointer shrink-0"
                aria-label="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* TOP-RIGHT STACKED DUAL CAPSULE (Layers + 3D/2D matching reference) */}
        <div className="absolute top-[116px] right-3 z-[470] flex flex-col items-end">
          <div className="w-11 bg-[#EBF5FA]/95 backdrop-blur-md rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.14)] border border-white/90 overflow-hidden divide-y divide-gray-300/60 flex flex-col">
            <button
              type="button"
              onClick={() => {
                setShowLayersPanel((v) => !v);
                setShowToolsMenu(false);
              }}
              className={`h-11 w-full flex items-center justify-center transition-colors cursor-pointer ${
                showLayersPanel ? 'bg-gray-900 text-white' : 'text-gray-900 hover:bg-white/80'
              }`}
              aria-label="Map layers and provinces"
              title="Layers & Provinces"
            >
              <Layers className="w-5 h-5 stroke-[1.9]" />
            </button>

            <button
              type="button"
              onClick={() => setIsTopoMode((v) => !v)}
              className={`h-11 w-full flex items-center justify-center text-xs font-black tracking-tight transition-colors cursor-pointer ${
                isTopoMode ? 'bg-gray-900 text-[#89F358]' : 'text-gray-900 hover:bg-white/80'
              }`}
              aria-label={isTopoMode ? 'Switch to 2D Street view' : 'Switch to 3D Terrain view'}
              title={isTopoMode ? 'Switch to Street view' : 'Switch to Terrain view'}
            >
              {isTopoMode ? '2D' : '3D'}
            </button>
          </div>

          {/* Floating Layers & Province Filter Popover */}
          {showLayersPanel && (
            <div className="mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 z-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-800">
                  Map Style & Province
                </span>
                <button
                  type="button"
                  onClick={() => setShowLayersPanel(false)}
                  className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"
                  aria-label="Close layers"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setIsTopoMode(false)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                    !isTopoMode
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  Street (2D)
                </button>
                <button
                  type="button"
                  onClick={() => setIsTopoMode(true)}
                  className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                    isTopoMode
                      ? 'bg-gray-950 text-white border-gray-950'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  Terrain (3D)
                </button>
              </div>

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block mb-1.5">
                South Africa Province
              </span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(PROVINCE_VIEWPORTS).map(([code, meta]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      onProvinceFilterChange(code);
                      setShowLayersPanel(false);
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                      provinceFilter === code
                        ? 'bg-[#89F358] text-gray-950 border-[#65C438]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM STACK: FLOATING GPS + GREEN "TOOLS" PILL + WHITE ROUNDED BOTTOM SHEET */}
        <div className="absolute bottom-0 inset-x-0 z-[480] flex flex-col pointer-events-none">
          {/* Row right above white sheet: Bottom-left GPS arrow + Centered green Tools pill */}
          <div className="max-w-md w-full mx-auto px-3.5 pb-3 relative flex items-center justify-center">
            {/* Bottom-left GPS Locate button (Maps-only permission) */}
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className={`pointer-events-auto absolute left-3.5 w-11 h-11 rounded-full shadow-[0_6px_18px_rgba(0,0,0,0.16)] border flex items-center justify-center active:scale-95 transition-all cursor-pointer disabled:opacity-75 ${
                geoPermission === 'granted' && userGeoCoords
                  ? 'bg-white text-[#1A73E8] border-[#1A73E8]/40'
                  : 'bg-[#EBF5FA]/95 hover:bg-white text-gray-900 border-white/90'
              }`}
              aria-label="Center on my location (Maps only)"
              title="Center on my location (Maps only)"
            >
              {isLocating ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#1A73E8]" />
              ) : (
                <Navigation className="w-4 h-4 stroke-[2.2]" />
              )}
            </button>

            {/* Centered Green "Tools" Pill (Exact reference button) */}
            <div className="relative pointer-events-auto">
              {showToolsMenu && (
                <div className="absolute bottom-13 left-1/2 -translate-x-1/2 w-56 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2 space-y-1 z-50">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                      Map Tools
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                        freeRouteOnline ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          freeRouteOnline ? 'bg-emerald-500' : 'bg-gray-400'
                        }`}
                      />
                      FreeRoute
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowToolsMenu(false);
                      setShowRoutePlanner(true);
                      setSelectedHazard(null);
                      setIsAlertListExpanded(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 text-[#1D4ED8]" />
                    <span>Plan Route</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowToolsMenu(false);
                      if (isPinMode) {
                        handleCancelPinMode();
                      } else {
                        setIsPinMode(true);
                        setPinLocationMode('map');
                        setPendingPinCoords(null);
                        setPinLocationQuery('');
                        setPinLocationSuggestions([]);
                        setPinError(null);
                        setSelectedHazard(null);
                        setShowRoutePlanner(false);
                        setIsAlertListExpanded(false);
                      }
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-100 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#941329]" />
                    <span>{isPinMode ? 'Cancel Hazard Pin' : 'Pin Road Hazard'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold text-gray-900 hover:bg-gray-100 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <LocateFixed className="w-4 h-4 text-[#1A73E8]" />
                      <span>Use GPS Location</span>
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400">
                      {geoPermission === 'granted' ? 'On' : geoPermission === 'denied' ? 'Blocked' : 'Maps'}
                    </span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowToolsMenu((v) => !v);
                  setShowLayersPanel(false);
                }}
                className="h-11 px-5 rounded-full bg-[#89F358] hover:bg-[#7CE84B] active:scale-95 text-gray-950 font-bold text-sm shadow-[0_8px_22px_rgba(0,0,0,0.20)] border border-[#72DE42] flex items-center gap-2 transition-all cursor-pointer"
              >
                <LayoutGrid className="w-4 h-4 stroke-[2.2]" />
                <span>Tools</span>
              </button>
            </div>
          </div>

          {/* WHITE ROUNDED BOTTOM SHEET (Matching reference "99 trails" sheet, clearing BottomNav) */}
          <div className="pointer-events-auto w-full bg-white rounded-t-[28px] shadow-[0_-8px_28px_rgba(0,0,0,0.14)] border-t border-gray-200/80 pb-[84px]">
            <div className="max-w-md mx-auto px-4">
              {/* Drag Handle */}
              <button
                type="button"
                onClick={() => {
                  if (isPinMode || pendingPinCoords) {
                    handleCancelPinMode();
                  } else if (selectedHazard) {
                    setSelectedHazard(null);
                  } else if (showRoutePlanner) {
                    setShowRoutePlanner(false);
                  } else if (!activeRoute) {
                    setIsAlertListExpanded((v) => !v);
                  }
                }}
                className="w-full pt-2.5 pb-1.5 flex justify-center cursor-pointer"
                aria-label="Toggle map sheet"
              >
                <span className="w-9 h-1 rounded-full bg-gray-300 block" />
              </button>

              {/* 1. Collapsed Default Summary ("X road alerts") matching reference "99 trails" */}
              {!hasSheetDetail && (
                <button
                  type="button"
                  onClick={() => setIsAlertListExpanded(true)}
                  className="w-full pb-3 pt-0.5 text-center cursor-pointer group"
                >
                  <span className="text-sm font-bold text-gray-900 group-hover:text-black">
                    {hazards.length} road {hazards.length === 1 ? 'alert' : 'alerts'}
                  </span>
                </button>
              )}

              {/* 2. Expanded Road Alerts List */}
              {isAlertListExpanded && !pendingPinCoords && !selectedHazard && !showRoutePlanner && !activeRoute && (
                <div className="pb-3 max-h-[42vh] flex flex-col">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-sm font-black text-gray-950">
                      {hazards.length} road {hazards.length === 1 ? 'alert' : 'alerts'} ·{' '}
                      {PROVINCE_VIEWPORTS[provinceFilter]?.label || 'All RSA'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAlertListExpanded(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                      aria-label="Collapse road alerts"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2 space-y-2 overflow-y-auto pr-1">
                    {hazards.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setSelectedHazard(h);
                          setIsAlertListExpanded(false);
                          mapRef.current?.flyTo([h.lat, h.lon], 14, { duration: 0.6 });
                        }}
                        className="w-full text-left p-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200/80 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                            {h.province} · {h.kind} · {timeAgo(h.createdAt)}
                          </span>
                          <p className="text-xs font-bold text-gray-950 truncate">{h.title}</p>
                          <p className="text-[11px] text-gray-600 truncate">{h.area}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200" title="True & Unsolved">
                            {h.confirmations}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200" title="False Report">
                            {h.falseReportCount ?? 0}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200" title="True & Solved">
                            {h.beingSolvedCount ?? 0}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Route Planner Panel (FreeRoute Start -> Destination) */}
              {showRoutePlanner && !pendingPinCoords && !selectedHazard && (
                <div className="pb-3 max-h-[46vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                      Plan Route
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRouteProfile('driving-car')}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                          routeProfile === 'driving-car'
                            ? 'bg-gray-950 text-white border-gray-950'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        Drive
                      </button>
                      <button
                        type="button"
                        onClick={() => setRouteProfile('foot-walking')}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${
                          routeProfile === 'foot-walking'
                            ? 'bg-gray-950 text-white border-gray-950'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        Walk
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRoutePlanner(false)}
                        className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"
                        aria-label="Close route planner"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void calculateRouteBetween();
                    }}
                    className="space-y-2"
                  >
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-3 py-1.5 flex items-stretch gap-2">
                      <div className="w-5 flex flex-col items-center justify-between py-2 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1A73E8] ring-4 ring-[#1A73E8]/20" />
                        <span className="w-[2px] h-3 bg-gray-300 rounded-full" />
                        <MapPin className="w-3.5 h-3.5 text-[#D93025]" />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col divide-y divide-gray-200">
                        <input
                          type="text"
                          value={originQuery}
                          onFocus={() => setActiveRouteField('origin')}
                          onChange={(e) => {
                            setOriginQuery(e.target.value);
                            setOriginPlace(null);
                            setActiveRouteField('origin');
                          }}
                          placeholder="Start suburb or Your location"
                          className="w-full py-1.5 text-xs font-semibold text-gray-900 bg-transparent focus:outline-none truncate"
                        />
                        <input
                          type="text"
                          value={destQuery}
                          onFocus={() => setActiveRouteField('dest')}
                          onChange={(e) => {
                            setDestQuery(e.target.value);
                            setDestPlace(null);
                            setActiveRouteField('dest');
                          }}
                          placeholder="Choose destination..."
                          className="w-full py-1.5 text-xs font-semibold text-gray-900 bg-transparent focus:outline-none truncate"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSwapEndpoints}
                        className="self-center w-8 h-8 rounded-full hover:bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 cursor-pointer"
                        aria-label="Swap start and destination"
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </button>
                    </div>

                    {activeRouteField === 'origin' && originSuggestions.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-md max-h-32 overflow-y-auto divide-y divide-gray-100">
                        {originSuggestions.map((place, idx) => (
                          <button
                            key={`${place.lat}-${place.lon}-${idx}`}
                            type="button"
                            onClick={() => {
                              setOriginPlace(place);
                              setOriginQuery(place.shortLabel);
                              setOriginSuggestions([]);
                              setActiveRouteField(null);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <p className="text-xs font-bold text-gray-900 truncate">{place.shortLabel}</p>
                            <p className="text-[10px] text-gray-500 truncate">{place.label}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {activeRouteField === 'dest' && destSuggestions.length > 0 && (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-md max-h-32 overflow-y-auto divide-y divide-gray-100">
                        {destSuggestions.map((place, idx) => (
                          <button
                            key={`${place.lat}-${place.lon}-${idx}`}
                            type="button"
                            onClick={() => {
                              setDestPlace(place);
                              setDestQuery(place.shortLabel);
                              setDestSuggestions([]);
                              setActiveRouteField(null);
                              void calculateRouteBetween(originPlace, place);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <p className="text-xs font-bold text-gray-900 truncate">{place.shortLabel}</p>
                            <p className="text-[10px] text-gray-500 truncate">{place.label}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isCalculatingRoute}
                      className="w-full py-2.5 bg-[#89F358] hover:bg-[#7CE84B] disabled:opacity-60 text-gray-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isCalculatingRoute ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Calculating Route...</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Get Route</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* 4. Active Route Summary & Steps */}
              {activeRoute && !selectedHazard && !pendingPinCoords && !showRoutePlanner && (
                <div className="pb-3 max-h-[45vh] overflow-y-auto">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-black text-[#1D4ED8]">
                          {formatDuration(activeRoute.durationSeconds)}
                        </span>
                        <span className="text-xs font-bold text-gray-700">
                          ({formatDistance(activeRoute.distanceMeters)})
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {originPlace?.shortLabel || originQuery || 'Origin'} →{' '}
                        {destPlace?.shortLabel || destQuery || 'Destination'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeRoute.steps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowSteps((v) => !v)}
                          className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Steps</span>
                          {showSteps ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClearRoute}
                        className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer"
                        aria-label="Clear route"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {showSteps && activeRoute.steps.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 max-h-36 overflow-y-auto space-y-1.5">
                      {activeRoute.steps.map((step, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-[11px]">
                          <span className="text-gray-800 font-medium">
                            {i + 1}. {step.instruction}
                          </span>
                          <span className="text-gray-500 font-semibold shrink-0">
                            {formatDistance(step.distanceMeters)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Selected Hazard Detail */}
              {selectedHazard && !pendingPinCoords && (
                <div className="pb-3 max-h-[45vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          selectedHazard.kind === 'accident'
                            ? 'bg-rose-50 border-rose-200 text-[#941329]'
                            : selectedHazard.kind === 'pothole'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}
                      >
                        {selectedHazard.kind === 'accident' ? (
                          <Siren className="w-4 h-4" />
                        ) : selectedHazard.kind === 'pothole' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <Car className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 block">
                          {selectedHazard.province} · {selectedHazard.kind} · {timeAgo(selectedHazard.createdAt)}
                        </span>
                        <h4 className="text-sm font-black text-gray-950 truncate">{selectedHazard.title}</h4>
                        <p className="text-[11px] font-semibold text-gray-600">{selectedHazard.area}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHazard(null)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
                      aria-label="Close hazard details"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-gray-700 mt-2 leading-relaxed">{selectedHazard.description}</p>

                  {(() => {
                    const unsolvedCount = selectedHazard.confirmations ?? 0;
                    const beingSolvedCount = selectedHazard.beingSolvedCount ?? 0;
                    const falseReportCount = selectedHazard.falseReportCount ?? 0;
                    const totalCount = unsolvedCount + beingSolvedCount + falseReportCount;
                    const totalVotes = Math.max(1, totalCount);
                    const myVote = hazardVotes[selectedHazard.id] || EMPTY_HAZARD_VOTE;
                    const activeVoteLabels = [
                      myVote.unsolved ? 'True & Unsolved' : null,
                      myVote.false_report ? 'False Report' : null,
                      myVote.being_solved ? 'True & Solved' : null,
                    ].filter(Boolean);
                    return (
                      <div className="mt-3 p-2.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5 gap-2">
                          <span className="shrink-0">Report Analysis</span>
                          <span className="text-gray-400 font-bold normal-case truncate">
                            {activeVoteLabels.length > 0
                              ? `Voted: ${activeVoteLabels.join(' + ')}`
                              : `${totalCount} ${totalCount === 1 ? 'response' : 'responses'}`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden flex mb-2">
                          <div
                            className="bg-rose-500 h-full transition-all"
                            style={{ width: `${(unsolvedCount / totalVotes) * 100}%` }}
                          />
                          <div
                            className="bg-slate-400 h-full transition-all"
                            style={{ width: `${(falseReportCount / totalVotes) * 100}%` }}
                          />
                          <div
                            className="bg-emerald-500 h-full transition-all"
                            style={{ width: `${(beingSolvedCount / totalVotes) * 100}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            disabled={confirmingId === selectedHazard.id}
                            onClick={() => void handleVoteHazardAnalysis(selectedHazard.id, 'unsolved')}
                            className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              myVote.unsolved
                                ? 'bg-rose-100 border-rose-500 ring-1 ring-rose-300'
                                : 'bg-rose-50 hover:bg-rose-100 border-rose-200'
                            }`}
                          >
                            <span className="block text-sm font-black text-rose-700 tabular-nums leading-none">
                              {unsolvedCount}
                            </span>
                            <span className="block text-[9.5px] font-bold text-rose-800 mt-1 leading-tight">
                              {myVote.unsolved ? '✓ ' : ''}True &amp; Unsolved
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={confirmingId === selectedHazard.id}
                            onClick={() => void handleVoteHazardAnalysis(selectedHazard.id, 'false_report')}
                            className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              myVote.false_report
                                ? 'bg-slate-200 border-slate-500 ring-1 ring-slate-300'
                                : 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                            }`}
                          >
                            <span className="block text-sm font-black text-slate-700 tabular-nums leading-none">
                              {falseReportCount}
                            </span>
                            <span className="block text-[9.5px] font-bold text-slate-600 mt-1 leading-tight">
                              {myVote.false_report ? '✓ ' : ''}False Report
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={confirmingId === selectedHazard.id}
                            onClick={() => void handleVoteHazardAnalysis(selectedHazard.id, 'being_solved')}
                            className={`p-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              myVote.being_solved
                                ? 'bg-emerald-100 border-emerald-500 ring-1 ring-emerald-300'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                            }`}
                          >
                            <span className="block text-sm font-black text-emerald-700 tabular-nums leading-none">
                              {beingSolvedCount}
                            </span>
                            <span className="block text-[9.5px] font-bold text-emerald-800 mt-1 leading-tight">
                              {myVote.being_solved ? '✓ ' : ''}True &amp; Solved
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => handleRouteToHazard(selectedHazard)}
                      className="w-full py-2 px-3 rounded-xl bg-[#89F358] hover:bg-[#7CE84B] text-gray-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Route Here</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 6. New Pin Submission Sheet (Click Map / Type Location / Current Network Location) */}
              {(isPinMode || pendingPinCoords) && (
                <div className="pb-3 max-h-[52vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-[#941329] shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-gray-950">Pin Live Road Condition</h4>
                        <p className="text-[11px] text-gray-500 truncate max-w-[240px]">
                          {pendingPinCoords
                            ? `${pendingPinCoords.area} · Drag or tap map to adjust`
                            : 'Choose how to set the pin location'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelPinMode}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer shrink-0"
                      aria-label="Cancel pin"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 3 Location Picker Methods */}
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPinLocationMode('map');
                        setPinLocationSuggestions([]);
                        setPinError(null);
                      }}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        pinLocationMode === 'map'
                          ? 'bg-gray-950 text-white border-gray-950'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>Click Map</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPinLocationMode('type');
                        setPinError(null);
                      }}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                        pinLocationMode === 'type'
                          ? 'bg-gray-950 text-white border-gray-950'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Search className="w-3.5 h-3.5 shrink-0" />
                      <span>Type Place</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleUseNetworkLocationForPin()}
                      disabled={isDetectingPinNetwork}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-65 ${
                        pinLocationMode === 'network'
                          ? 'bg-gray-950 text-white border-gray-950'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {isDetectingPinNetwork ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>Network</span>
                    </button>
                  </div>

                  {/* Typed Address / Location Picker */}
                  {pinLocationMode === 'type' && (
                    <div className="mb-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <input
                            type="text"
                            value={pinLocationQuery}
                            onChange={(e) => setPinLocationQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSearchTypedPinLocation();
                              }
                            }}
                            placeholder="Type road, suburb, or landmark..."
                            className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-gray-950 focus:outline-none"
                          />
                          {isSearchingPinLocation && (
                            <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleSearchTypedPinLocation()}
                          className="px-3 py-2 rounded-xl bg-gray-950 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          Locate
                        </button>
                      </div>

                      {pinLocationSuggestions.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-md max-h-32 overflow-y-auto divide-y divide-gray-100">
                          {pinLocationSuggestions.map((place, idx) => (
                            <button
                              key={`${place.lat}-${place.lon}-${idx}`}
                              type="button"
                              onClick={() => handleSelectTypedPinPlace(place)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{place.shortLabel}</p>
                                <p className="text-[10px] text-gray-500 truncate">{place.label}</p>
                              </div>
                              <span className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                                Pin
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Pin Location Status Pill */}
                  <div
                    className={`mb-2.5 px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                      pendingPinCoords
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}
                  >
                    <span className="font-semibold truncate">
                      {pendingPinCoords
                        ? `Pinned at: ${pendingPinCoords.area}`
                        : pinLocationMode === 'map'
                          ? 'Tap anywhere on the map above to drop your pin'
                          : pinLocationMode === 'type'
                            ? 'Search & select a place above to drop your pin'
                            : 'Detecting your current location through network...'}
                    </span>
                    {pendingPinCoords && (
                      <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                        Shown on map
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSubmitHazardPin} className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'pothole', label: 'Pothole' },
                        { id: 'accident', label: 'Accident' },
                        { id: 'traffic', label: 'Traffic Jam' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPinKind(opt.id as 'pothole' | 'accident' | 'traffic')}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                            pinKind === opt.id
                              ? 'bg-gray-950 text-white border-gray-950'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={pinTitle}
                      onChange={(e) => setPinTitle(e.target.value)}
                      placeholder="Short headline (e.g. Deep pothole left lane)"
                      maxLength={80}
                      className="w-full px-3 py-2 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-gray-950 focus:outline-none"
                    />

                    <input
                      type="text"
                      value={pinDescription}
                      onChange={(e) => setPinDescription(e.target.value)}
                      placeholder="Optional driver advice or lane details"
                      maxLength={180}
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-gray-950 focus:outline-none"
                    />

                    {pinError && (
                      <p className="text-[11px] font-semibold text-[#941329]">{pinError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingPin || !pendingPinCoords}
                      className="w-full py-2.5 bg-[#89F358] hover:bg-[#7CE84B] disabled:opacity-55 text-gray-950 text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingPin ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Publishing Pin...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Publish Live Map Pin</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
