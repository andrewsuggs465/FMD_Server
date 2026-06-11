import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type * as LeafletType from 'leaflet';
import { FullScreen } from 'leaflet.fullscreen';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
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
    phoneVisible,
  } = useStore();

  const { t } = useTranslation('dashboard');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletType.Map | null>(null);
  const leafletRef = useRef<typeof LeafletType | null>(null);

  const tileLayerRef = useRef<LeafletType.TileLayer | null>(null);
  const markersLayerRef = useRef<LeafletType.LayerGroup | null>(null);
  const accuracyCirclesLayerRef = useRef<LeafletType.LayerGroup | null>(null);
  const latestMarkersLayerRef = useRef<LeafletType.LayerGroup | null>(null);
  const polylineRef = useRef<LeafletType.Polyline | null>(null);
  const selectedIconRef = useRef<LeafletType.Icon | null>(null);

  const trackerLayerGroupsRef = useRef<Map<string, LeafletType.LayerGroup>>(new Map());

  const locationCacheRef = useRef<Set<number>>(new Set());
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const lastSelectedRef = useRef<string | null | undefined>(undefined);

  const { mapPrimaryColor, mapAccentColor } = useThemeColors();
  const [mapReady, setMapReady] = useState(false);
  const [tileServerUrl, setTileServerUrl] = useState('');

  // Scrub position within the selected tracker's filtered history. -1 = follow latest.
  const [trackerScrub, setTrackerScrub] = useState(-1);

  const selectedTracker = useMemo(
    () => trackers.find((tr) => tr.fmdId === selectedDeviceId) ?? null,
    [trackers, selectedDeviceId]
  );

  // Phone history restricted to the active time filter, keeping original indices
  const phoneFiltered = useMemo(() => {
    const cutoff = getTimeFilterCutoff(timeFilter);
    return locations
      .map((loc, idx) => ({ loc, idx }))
      .filter(({ loc }) => timeFilter === 'all' || loc.date >= cutoff);
  }, [locations, timeFilter]);

  const trackerFiltered = useMemo(() => {
    if (!selectedTracker) return [];
    const cutoff = getTimeFilterCutoff(timeFilter);
    return selectedTracker.locations.filter(
      (loc) => timeFilter === 'all' || loc.date >= cutoff
    );
  }, [selectedTracker, timeFilter]);

  const effectiveTrackerScrub =
    trackerScrub >= 0 && trackerScrub < trackerFiltered.length
      ? trackerScrub
      : trackerFiltered.length - 1;

  // Reset the scrubber whenever the device tab or the time filter changes
  useEffect(() => {
    setTrackerScrub(-1);
  }, [selectedDeviceId, timeFilter]);

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
        latestMarkersLayerRef.current = leafletRef.current.layerGroup().addTo(mapInstanceRef.current);

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

  const popupHtml = (label: string | null, loc: (typeof locations)[number]) => `
    <div style="min-width:5rem">
      ${label ? `<strong>${label}</strong><br/>` : ''}
      <strong>${t('time')}:</strong> ${new Date(loc.date).toLocaleString()}<br/>
      <strong>${t('battery')}:</strong> ${loc.bat}%<br/>
      <strong>${t('provider')}:</strong> ${formatProvider(loc.provider)}<br/>
      ${loc.accuracy ? `<strong>${t('accuracy')}:</strong> ${convertDistance(loc.accuracy, units)}<br/>` : ''}
      ${loc.altitude !== undefined ? `<strong>${t('altitude')}:</strong> ${convertDistance(loc.altitude, units)}<br/>` : ''}
      ${loc.speed !== undefined ? `<strong>${t('speed')}:</strong> ${convertSpeed(loc.speed, units)}<br/>` : ''}
      ${loc.bearing !== undefined ? `<strong>${t('bearing')}:</strong> ${loc.bearing.toFixed(0)}°` : ''}
    </div>`;

  // Latest-position markers for every visible device that is NOT the selected tab,
  // so all devices can be seen on the map at once. Clicking one selects its tab.
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current || !latestMarkersLayerRef.current || !mapReady)
      return;

    const L = leafletRef.current;
    const layer = latestMarkersLayerRef.current;
    layer.clearLayers();

    const { setSelectedDevice } = useStore.getState();

    if (phoneVisible && selectedDeviceId !== null && locations.length > 0) {
      const loc = locations[locations.length - 1];
      const marker = L.marker([loc.lat, loc.lon], { opacity: 0.85 })
        .addTo(layer)
        .bindPopup(popupHtml('Phone', loc), {
          autoClose: false,
          closeOnClick: false,
          closeButton: false,
        });
      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());
      marker.on('click', () => setSelectedDevice(null));
    }

    for (const tracker of trackers) {
      if (!tracker.visible || tracker.fmdId === selectedDeviceId || tracker.locations.length === 0)
        continue;
      const loc = tracker.locations[tracker.locations.length - 1];
      const cm = L.circleMarker([loc.lat, loc.lon], {
        radius: 8,
        color: '#fff',
        fillColor: tracker.color,
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(layer);
      cm.bindPopup(popupHtml(tracker.label, loc), {
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
      });
      cm.on('mouseover', () => cm.openPopup());
      cm.on('mouseout', () => cm.closePopup());
      cm.on('click', () => setSelectedDevice(tracker.fmdId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, phoneVisible, trackers, selectedDeviceId, locations, units, t]);

  // Phone location history (shown when phone tab is selected)
  useEffect(() => {
    if (
      !mapInstanceRef.current ||
      !leafletRef.current ||
      !markersLayerRef.current ||
      !accuracyCirclesLayerRef.current
    )
      return;

    const showPhone = selectedDeviceId === null && phoneVisible;

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

    let cachedLocations: typeof locations;
    let cachedIndices: number[];
    let effectiveCurrentIndex: number;

    if (timeFilter !== 'all') {
      cachedIndices = phoneFiltered.map(({ idx }) => idx);
      cachedLocations = phoneFiltered.map(({ loc }) => loc);
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
        .bindPopup(popupHtml(null, loc), {
          autoClose: false,
          closeOnClick: false,
          closeButton: false,
        });

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

    // Pan to the currently scrubbed/selected point rather than the newest one,
    // so the scrubber can walk back through history
    const current = locations[effectiveCurrentIndex] ?? cachedLocations[cachedLocations.length - 1];
    const locationChanged =
      !lastLocationRef.current ||
      lastLocationRef.current.lat !== current.lat ||
      lastLocationRef.current.lon !== current.lon;

    if (locationChanged) {
      if (locationCacheRef.current.size <= 1) {
        mapInstanceRef.current.setView([current.lat, current.lon], calculateZoomLevel(current.accuracy));
      } else {
        mapInstanceRef.current.panTo([current.lat, current.lon]);
      }
      lastLocationRef.current = { lat: current.lat, lon: current.lon };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocationIndex, units, locations, mapPrimaryColor, mapAccentColor, mapReady, selectedDeviceId, timeFilter, phoneVisible]);

  // Tracker history (shown only for the selected tracker tab)
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current || !mapReady) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    // Remove layer groups for trackers that no longer exist
    const currentIds = new Set(trackers.map((tr) => tr.fmdId));
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

      // Only render history for the selected, visible tracker
      if (selectedDeviceId !== tracker.fmdId || !tracker.visible) continue;
      if (trackerFiltered.length === 0) continue;

      if (trackerFiltered.length > 1) {
        L.polyline(
          trackerFiltered.map((loc) => [loc.lat, loc.lon] as [number, number]),
          { color: tracker.color, weight: POLYLINE_WEIGHT, opacity: POLYLINE_OPACITY }
        ).addTo(group);
      }

      trackerFiltered.forEach((loc, i) => {
        const isCurrent = i === effectiveTrackerScrub;
        const cm = L.circleMarker([loc.lat, loc.lon], {
          radius: isCurrent ? 9 : 5,
          color: '#fff',
          fillColor: tracker.color,
          fillOpacity: isCurrent ? 1 : 0.75,
          weight: isCurrent ? 2 : 1,
        }).addTo(group);

        cm.bindPopup(popupHtml(tracker.label, loc), {
          autoClose: false,
          closeOnClick: false,
          closeButton: false,
        });
        cm.on('mouseover', () => cm.openPopup());
        cm.on('mouseout', () => cm.closePopup());
        cm.on('click', () => setTrackerScrub(i));

        if (isCurrent && loc.accuracy) {
          L.circle([loc.lat, loc.lon], {
            radius: loc.accuracy,
            color: tracker.color,
            fillColor: tracker.color,
            fillOpacity: CIRCLE_FILL_OPACITY,
            weight: CIRCLE_WEIGHT,
          }).addTo(group);
        }
      });

      const current = trackerFiltered[effectiveTrackerScrub];
      if (lastSelectedRef.current !== tracker.fmdId) {
        // Switched to this tab — zoom to the device
        map.setView([current.lat, current.lon], calculateZoomLevel(current.accuracy));
      } else {
        map.panTo([current.lat, current.lon]);
      }
    }

    lastSelectedRef.current = selectedDeviceId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackers, trackerFiltered, effectiveTrackerScrub, mapReady, units, t, selectedDeviceId]);

  // ----- Scrubber state for the active tab -----
  const isPhoneTab = selectedDeviceId === null;
  const scrubLength = isPhoneTab ? phoneFiltered.length : trackerFiltered.length;
  const scrubPos = isPhoneTab
    ? Math.max(
        0,
        phoneFiltered.findIndex(({ idx }) => idx === currentLocationIndex) !== -1
          ? phoneFiltered.findIndex(({ idx }) => idx === currentLocationIndex)
          : phoneFiltered.length - 1
      )
    : effectiveTrackerScrub;
  const scrubDate =
    scrubLength > 0
      ? isPhoneTab
        ? phoneFiltered[scrubPos]?.loc.date
        : trackerFiltered[scrubPos]?.date
      : undefined;

  const setScrubPos = (pos: number) => {
    const clamped = Math.max(0, Math.min(scrubLength - 1, pos));
    if (isPhoneTab) {
      const target = phoneFiltered[clamped];
      if (target) useStore.setState({ currentLocationIndex: target.idx });
    } else {
      setTrackerScrub(clamped);
    }
  };

  const fitAllDevices = () => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const pts: [number, number][] = [];
    if (phoneVisible && locations.length > 0) {
      const loc = locations[locations.length - 1];
      pts.push([loc.lat, loc.lon]);
    }
    for (const tracker of trackers) {
      if (tracker.visible && tracker.locations.length > 0) {
        const loc = tracker.locations[tracker.locations.length - 1];
        pts.push([loc.lat, loc.lon]);
      }
    }
    if (pts.length === 0) return;
    mapInstanceRef.current.fitBounds(leafletRef.current.latLngBounds(pts), {
      padding: [60, 60],
      maxZoom: 16,
    });
  };

  return (
    <div className="bg-fmd-light dark:bg-fmd-dark relative flex h-full w-full flex-col rounded-lg">
      <div ref={mapRef} className="relative flex-1 rounded-lg" />

      {/* History scrubber — top-center, steps through the selected device's history */}
      {mapReady && scrubLength > 1 && (
        <div className="pointer-events-auto absolute top-[10px] left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded border border-gray-300 bg-white px-2.5 py-1.5 shadow-sm dark:border-gray-600 dark:bg-gray-800">
          <button
            onClick={() => setScrubPos(scrubPos - 1)}
            disabled={scrubPos <= 0}
            title="Previous location"
            className="rounded p-0.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0}
            max={scrubLength - 1}
            value={scrubPos}
            onChange={(e) => setScrubPos(Number(e.target.value))}
            className="w-28 accent-blue-500 sm:w-48"
          />
          <button
            onClick={() => setScrubPos(scrubPos + 1)}
            disabled={scrubPos >= scrubLength - 1}
            title="Next location"
            className="rounded p-0.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-xs whitespace-nowrap text-gray-700 dark:text-gray-200">
            {scrubPos + 1}/{scrubLength}
            {scrubDate
              ? ` · ${new Date(scrubDate).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
        </div>
      )}

      {/* Time filter + fit-all — Leaflet-style control bar, bottom-left */}
      {mapReady && (
        <div className="pointer-events-auto absolute bottom-[38px] left-[10px] z-[1000] flex overflow-hidden rounded border border-gray-300 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
          {TIME_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => useStore.getState().setTimeFilter(value)}
              title={value === 'all' ? 'Show all history' : `Show last ${value}`}
              className={`border-r border-gray-300 px-2.5 py-1.5 text-xs font-medium transition-colors dark:border-gray-600 ${
                timeFilter === value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={fitAllDevices}
            title="Fit all devices in view"
            className="px-2.5 py-1.5 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
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
