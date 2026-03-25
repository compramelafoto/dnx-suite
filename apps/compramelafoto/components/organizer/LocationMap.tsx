"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // Buenos Aires

type LocationMapInnerProps = {
  lat: number;
  lng: number;
  editable: boolean;
  onPositionChange?: (lat: number, lng: number) => void;
};

function MapClickHandler({
  editable,
  onPositionChange,
}: {
  editable: boolean;
  onPositionChange?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!editable || !onPositionChange) return;
      const { lat, lng } = e.latlng;
      onPositionChange(lat, lng);
    },
  });
  return null;
}

function MapCenterUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const pos = useMemo((): [number, number] => [lat, lng], [lat, lng]);
  useEffect(() => {
    if (lat !== 0 || lng !== 0) {
      map.setView(pos, map.getZoom());
    }
  }, [map, pos, lat, lng]);
  return null;
}

function LocationMapInner({
  lat,
  lng,
  editable,
  onPositionChange,
}: LocationMapInnerProps) {
  const hasValidCoords = lat !== 0 || lng !== 0;
  const center: [number, number] = hasValidCoords
    ? [lat, lng]
    : DEFAULT_CENTER;
  const zoom = hasValidCoords ? 15 : 4;

  const markerPos: [number, number] = hasValidCoords ? [lat, lng] : center;

  const eventHandlers = useCallback(
    (e: L.LeafletEvent) => {
      if (!editable || !onPositionChange) return;
      const marker = e.target as L.Marker;
      const pos = marker.getLatLng();
      onPositionChange(pos.lat, pos.lng);
    },
    [editable, onPositionChange]
  );

  return (
    <>
      <MapClickHandler editable={editable} onPositionChange={onPositionChange} />
      <MapCenterUpdater lat={lat} lng={lng} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {editable ? (
        <Marker
          position={markerPos}
          draggable
          eventHandlers={{ dragend: eventHandlers }}
        />
      ) : hasValidCoords ? (
        <Marker position={markerPos} />
      ) : null}
    </>
  );
}

export type LocationMapProps = {
  latitude: number;
  longitude: number;
  editable?: boolean;
  onPositionChange?: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
};

export default function LocationMap({
  latitude,
  longitude,
  editable = false,
  onPositionChange,
  height = "280px",
  className = "",
}: LocationMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
    });
    setMounted(true);
  }, []);

  const lat = Number.isFinite(latitude) ? latitude : 0;
  const lng = Number.isFinite(longitude) ? longitude : 0;

  if (!mounted) {
    return (
      <div
        className={`rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center text-gray-500 text-sm ${className}`}
        style={{ height }}
      >
        Cargando mapa…
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg overflow-hidden border border-gray-200 z-0 ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={lat !== 0 || lng !== 0 ? [lat, lng] : DEFAULT_CENTER}
        zoom={lat !== 0 || lng !== 0 ? 15 : 4}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <LocationMapInner
          lat={lat}
          lng={lng}
          editable={editable}
          onPositionChange={onPositionChange}
        />
      </MapContainer>
    </div>
  );
}
