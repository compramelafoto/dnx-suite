"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

type InnerProps = {
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
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevKey = useRef<string | null>(null);
  const pos = useMemo((): [number, number] => [lat, lng], [lat, lng]);

  useEffect(() => {
    if (lat === 0 && lng === 0) return;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const jumped = prevKey.current !== null && prevKey.current !== key;
    prevKey.current = key;
    // Al elegir un resultado (salto de coords), acercar; si el usuario mueve el pin, conservar zoom.
    const nextZoom = jumped ? Math.max(map.getZoom(), 15) : Math.max(map.getZoom(), 4);
    if (jumped || map.getZoom() < 10) {
      map.setView(pos, Math.max(nextZoom, 15));
    } else {
      map.setView(pos, map.getZoom());
    }
  }, [map, pos, lat, lng]);

  return null;
}

function EventLocationMapInner({ lat, lng, editable, onPositionChange }: InnerProps) {
  const hasValid = lat !== 0 || lng !== 0;
  const center: [number, number] = hasValid ? [lat, lng] : DEFAULT_CENTER;
  const markerPos: [number, number] = hasValid ? [lat, lng] : center;

  const onDragEnd = useCallback(
    (e: L.LeafletEvent) => {
      if (!editable || !onPositionChange) return;
      const pos = (e.target as L.Marker).getLatLng();
      onPositionChange(pos.lat, pos.lng);
    },
    [editable, onPositionChange],
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
        <Marker position={markerPos} draggable eventHandlers={{ dragend: onDragEnd }} />
      ) : hasValid ? (
        <Marker position={markerPos} />
      ) : null}
    </>
  );
}

export type EventLocationMapProps = {
  latitude: number;
  longitude: number;
  editable?: boolean;
  onPositionChange?: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
};

/** Mapa Leaflet bajo demanda (solo en editor / formulario). */
export default function EventLocationMap({
  latitude,
  longitude,
  editable = false,
  onPositionChange,
  height = "280px",
  className = "",
}: EventLocationMapProps) {
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
  const hasValid = lat !== 0 || lng !== 0;

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-[var(--is-border)] bg-[var(--is-surface)] text-sm text-[var(--is-muted)] ${className}`}
        style={{ height }}
      >
        Cargando mapa…
      </div>
    );
  }

  return (
    <div
      className={`z-0 overflow-hidden rounded-xl border border-[var(--is-border)] ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={hasValid ? [lat, lng] : DEFAULT_CENTER}
        zoom={hasValid ? 15 : 4}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <EventLocationMapInner
          lat={lat}
          lng={lng}
          editable={editable}
          onPositionChange={onPositionChange}
        />
      </MapContainer>
    </div>
  );
}
