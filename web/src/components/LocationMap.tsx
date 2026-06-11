import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type * as LeafletType from 'leaflet';
import { FullScreen } from 'leaflet.fullscreen';
import { useStore, type TimeFilter } from '@/lib/store';
import { convertDistance, convertSpeed } from '@/utils/units';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spinner } from '@/components/ui/spinner';

import 'leaflet/dist/leaflet.css';
import { apiService } from '@/lib/apiService';

const POLYLINE_OPACITY = 0.6;
const POLYLINE_WEIGHT = 3;
const CIRCLE_FILL_OPACITY = 0.25;
const CIRCLE_WEIGHT = 0;
const ACCURACY_CIRCLE_RANGE = 5;
const MARKER_WINDOW = 50;

const TIME_FILTER_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: 'all', label: 'All' },
];

const formatProvider = (provider: string): string => {
  const providerMap: Record<string, string> = { gps: 'GPS', network: 'Network' };
  return providerMap[provider] ?? provider;
};

const calculateZoomLevel = (accuracy?: number): number => {
  if (!accuracy) return 16;
  return Math.max(10, Math.min(17, 17 - Math.floor(Math.log2(accuracy / 100))));
};

const getTimeFilterCutoff = (filter: TimeFilter): number => {
  if (filter === 'all') return 0;
  const ms: Record<Exclude<TimeFilter, 'all'>, number> = {
    '1h': 3_600_000,
    '6h': 21_600_000,
    '24h': 86_400_000,
    '7d': 604_800_000,
  };
  return Date.now() - ms[filter];
};

export const LocationMap = () => {
  const {
    locations,
    units,
    currentLocationIndex,
    isLocationsLoading,
    trackers,
    timeFilter,
    selectedDeviceId,
  } = useStore();

  const { t } = useTranslation('dashboard');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletType.Map | null>(null);
  const leafletRef = useRef<typeof LeafletType | null>(null);

  const tileLayerRef = useRef<LeafletType.TileLayer | null>(null);
  const markersLayerRef = useRef<LeafletType.LayerGroup | null>(null);
  const accuracyCirclesLayerRef = useRef<LeafletType.LayerGroup | null>(null);
  const polylineRef = useRef<LeafletType.Polyline | null>(null);
  const selectedIconRef = useRef<LeafletType.Icon | null>(null);

  const trackerLayerGroupsRef = useRef<Map<string, LeafletType.LayerGroup>>(new Map());

  const locationCacheRef = useRef<Set<number>>(new Set());
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);

  const { mapPrimaryColor, mapAccentColor } = useThemeColors();
  const [mapReady, setMapReady] = useState(false);
  const [tileServerUrl, setTileServerUrl] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setTileServerUrl(await apiService.getTileServerUrl());
      } catch {
        setTileServerUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
      }
    })();
  }, []);

  // Initialise the map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || isLocationsLoading || !tileServerUrl) return;

    const loadLeaflet = async () => {
      if (!leafletRef.current) {
        const L = await import('leaflet');
        leafletRef.current = L.default;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: './marker-icon-2x.png',
          iconUrl: './marker-icon.png',
          shadowUrl: './marker-shadow.png',
        });

        selectedIconRef.current = new L.Icon({
          iconRetinaUrl: './marker-icon-2x.png',
          iconUrl: './marker-icon.png',
          shadowUrl: './marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
          className: 'marker-selected',
        });
      }

      if (!mapInstanceRef.current && mapRef.current) {
        const firstLocation = locations[0];
        const initialView: [number, number] = firstLocation
          ? [firstLocation.lat, firstLocation.lon]
          : [20, 0];
        const initialZoom = firstLocation ? calculateZoomLevel(firstLocation.accuracy) : 2;

        mapInstanceRef.current = leafletRef.current
          .map(mapRef.current)
          .setView(initialView, initialZoom);

        markersLayerRef.current = leafletRef.current.layerGroup().addTo(mapInstanceRef.current);
        accuracyCirclesLayerRef.current = leafletRef.current.layerGroup().addTo(mapInstanceRef.current);

        tileLayerRef.current = leafletRef.current
          .tileLayer(tileServerUrl, {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          })
          .addTo(mapInstanceRef.current);

        if (mapInstanceRef.current.attributionControl) {
          mapInstanceRef.current.attributionControl.setPrefix('');
        }

        mapInstanceRef.current.addControl(new FullScreen());

        setMapReady(true);
      }
    };

    void loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        trackerLayerGroupsRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocationsLoading, tileServerUrl]);

  // Phone location markers (shown when phone tab is selected)
  useEffect(() => {
    if (
      !mapInstanceRef.current ||
      !leafletRef.current ||
      !markersLayerRef.current ||
      !accuracyCirclesLayerRef.current
    )
      return;

    const showPhone = selectedDeviceId === null;

    if (!showPhone || locations.length === 0) {
      markersLayerRef.current.clearLayers();
      accuracyCirclesLayerRef.current.clearLayers();
      polylineRef.current?.remove();
      polylineRef.current = null;
      if (locations.length === 0) {
        locationCacheRef.current.clear();
        lastLocationRef.current = null;
        mapInstanceRef.current.setView([20, 2], 2);
      }
      return;
    }

    const cutoff = getTimeFilterCutoff(timeFilter);

    let cachedLocations: typeof locations;
    let cachedIndices: number[];
    let effectiveCurrentIndex: number;

    if (timeFilter !== 'all') {
      const filtered = locations
        .map((loc, idx) => ({ loc, idx }))
        .filter(({ loc }) => loc.date >= cutoff);
      cachedIndices = filtered.map(({ idx }) => idx);
      cachedLocations = filtered.map(({ loc }) => loc);
      effectiveCurrentIndex = cachedIndices.includes(currentLocationIndex)
        ? currentLocationIndex
        : (cachedIndices[cachedIndices.length - 1] ?? currentLocationIndex);
    } else {
      const location = locations[currentLocationIndex];
      if (!location) return;

      locationCacheRef.current.add(currentLocationIndex);
      const windowStart = Math.max(0, currentLocationIndex - MARKER_WINDOW);
      for (const idx of locationCacheRef.current) {
        if (idx < windowStart) locationCacheRef.current.delete(idx);
      }

      cachedIndices = Array.from(locationCacheRef.current).sort((a, b) => a - b);
      cachedLocations = cachedIndices.map((idx) => locations[idx]);
      effectiveCurrentIndex = currentLocationIndex;
    }

    if (cachedLocations.length === 0) return;

    markersLayerRef.current.clearLayers();
    accuracyCirclesLayerRef.current.clearLayers();
    polylineRef.current?.remove();

    const latLngs: [number, number][] = cachedLocations.map((loc) => [loc.lat, loc.lon]);

    if (latLngs.length > 1) {
      polylineRef.current = leafletRef.current
        .polyline(latLngs, { color: mapPrimaryColor, weight: POLYLINE_WEIGHT, opacity: POLYLINE_OPACITY })
        .addTo(mapInstanceRef.current);
    }

    for (let i = 0; i < cachedIndices.length; i++) {
      const idx = cachedIndices[i];
      const loc = cachedLocations[i];
      const isCurrentLocation = idx === effectiveCurrentIndex;

      const marker = leafletRef.current
        .marker(
          [loc.lat, loc.lon],
          isCurrentLocation && selectedIconRef.current
            ? { icon: selectedIconRef.current, zIndexOffset: 1000 }
            : {}
        )
        .addTo(markersLayerRef.current)
        .bindPopup(
          `<div style="min-width:5rem">
            <strong>${t('time')}:</strong> ${new Date(loc.date).toLocaleString()}<br/>
            <strong>${t('battery')}:</strong> ${loc.bat}%<br/>
            <strong>${t('provider')}:</strong> ${formatProvider(loc.provider)}<br/>
            ${loc.accuracy ? `<strong>${t('accuracy')}:</strong> ${convertDistance(loc.accuracy, units)}<br/>` : ''}
            ${loc.altitude !== undefined ? `<strong>${t('altitude')}:</strong> ${convertDistance(loc.altitude, units)}<br/>` : ''}
            ${loc.speed !== undefined ? `<strong>${t('speed')}:</strong> ${convertSpeed(loc.speed, units)}<br/>` : ''}
            ${loc.bearing !== undefined ? `<strong>${t('bearing')}:</strong> ${loc.bearing.toFixed(0)}°` : ''}
          </div>`,
          { autoClose: false, closeOnClick: false, closeButton: false }
        );

      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());

      if (
        loc.accuracy &&
        idx >= effectiveCurrentIndex - ACCURACY_CIRCLE_RANGE &&
        idx <= effectiveCurrentIndex + ACCURACY_CIRCLE_RANGE
      ) {
        const circleColor = isCurrentLocation ? mapAccentColor : mapPrimaryColor;
        leafletRef.current
          .circle([loc.lat, loc.lon], {
            radius: loc.accuracy,
            color: circleColor,
            fillColor: circleColor,
            fillOpacity: CIRCLE_FILL_OPACITY,
            weight: CIRCLE_WEIGHT,
          })
          .addTo(accuracyCirclesLayerRef.current);
      }
    }

    const { lat, lon } = cachedLocations[cachedLocations.length - 1];
    const locationChanged =
      !lastLocationRef.current ||
      lastLocationRef.current.lat !== lat ||
      lastLocationRef.current.lon !== lon;

    if (locationChanged) {
      if (locationCacheRef.current.size <= 1) {
        mapInstanceRef.current.setView([lat, lon], calculateZoomLevel(cachedLocations[cachedLocations.length - 1].accuracy));
      } else {
        mapInstanceRef.current.panTo([lat, lon]);
      }
      lastLocationRef.current = { lat, lon };
    }
  }, [currentLocationIndex, units, locations, mapPrimaryColor, mapAccentColor, mapReady, selectedDeviceId, timeFilter]);

  // Tracker markers (shown only for the selected tracker tab)
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current || !mapReady) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    const cutoff = getTimeFilterCutoff(timeFilter);

    // Remove layer groups for trackers that no longer exist
    const currentIds = new Set(trackers.map((t) => t.fmdId));
    for (const [id, group] of trackerLayerGroupsRef.current) {
      if (!currentIds.has(id)) {
        group.remove();
        trackerLayerGroupsRef.current.delete(id);
      }
    }

    for (const tracker of trackers) {
      if (!trackerLayerGroupsRef.current.has(tracker.fmdId)) {
        trackerLayerGroupsRef.current.set(tracker.fmdId, L.layerGroup().addTo(map));
      }
      const group = trackerLayerGroupsRef.current.get(tracker.fmdId)!;
      group.clearLayers();

      // Only render the selected tracker
      if (selectedDeviceId !== tracker.fmdId || tracker.locations.length === 0) continue;

      const filtered = tracker.locations.filter((loc) => loc.date >= cutoff);
      if (filtered.length === 0) continue;

      if (filtered.length > 1) {
        L.polyline(
          filtered.map((loc) => [loc.lat, loc.lon] as [number, number]),
          { color: tracker.color, weight: POLYLINE_WEIGHT, opacity: POLYLINE_OPACITY }
        ).addTo(group);
      }

      filtered.forEach((loc, i) => {
        const isLatest = i === filtered.length - 1;
        const cm = L.circleMarker([loc.lat, loc.lon], {
          radius: isLatest ? 9 : 5,
          color: '#fff',
          fillColor: tracker.color,
          fillOpacity: isLatest ? 1 : 0.75,
          weight: isLatest ? 2 : 1,
        }).addTo(group);

        cm.bindPopup(
          `<div style="min-width:5rem">
            <strong>${tracker.label}</strong><br/>
            <strong>${t('time')}:</strong> ${new Date(loc.date).toLocaleString()}<br/>
            <strong>${t('battery')}:</strong> ${loc.bat}%<br/>
            <strong>${t('provider')}:</strong> ${formatProvider(loc.provider)}<br/>
            ${loc.accuracy ? `<strong>${t('accuracy')}:</strong> ${convertDistance(loc.accuracy, units)}<br/>` : ''}
          </div>`,
          { autoClose: false, closeOnClick: false, closeButton: false }
        );
        cm.on('mouseover', () => cm.openPopup());
        cm.on('mouseout', () => cm.closePopup());
      });

      // Pan to tracker's latest location when switching to this tab
      const latest = filtered[filtered.length - 1];
      mapInstanceRef.current.setView([latest.lat, latest.lon], calculateZoomLevel(latest.accuracy));
    }
  }, [trackers, timeFilter, mapReady, units, t, selectedDeviceId]);

  return (
    <div className="bg-fmd-light dark:bg-fmd-dark relative flex h-full w-full flex-col rounded-lg">
      <div ref={mapRef} className="relative flex-1 rounded-lg" />

      {/* Time filter — Leaflet-style control bar, bottom-left */}
      {mapReady && (
        <div className="pointer-events-auto absolute bottom-[38px] left-[10px] z-[1000] flex overflow-hidden rounded border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
          {TIME_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => useStore.getState().setTimeFilter(value)}
              title={value === 'all' ? 'Show all history' : `Show last ${value}`}
              className={`border-r px-2.5 py-1.5 text-xs font-medium last:border-r-0 transition-colors border-gray-300 dark:border-gray-600 ${
                timeFilter === value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isLocationsLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <Spinner />
        </div>
      )}
    </div>
  );
};
