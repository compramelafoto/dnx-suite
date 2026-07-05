"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ARGENTINA_BOUNDS,
  ARGENTINA_CENTER,
  ARGENTINA_DEFAULT_ZOOM,
} from "@/lib/geo/argentina-bounds";
import { boundingBoxForRadiusKm } from "@/lib/geo";
import {
  formatPhotographerWorkLocationParts,
  photographerInstagramHref,
  photographerInstagramLabel,
  photographerWhatsappHref,
} from "@/lib/admin/photographer-contact-links";

export type PhotographerMapPoint = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  companyName: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  publicPageHandler: string | null;
  whatsapp: string | null;
  instagram: string | null;
  inArgentina: boolean;
  distanceKm?: number;
};

export type MapRadiusSearch = {
  lat: number;
  lng: number;
  label: string;
  radiusKm: number;
};

const MARKER_COLOR = "#c27b3d";
const MARKER_COLOR_OUT = "#6b7280";

export {
  photographerInstagramHref,
  photographerInstagramLabel,
  photographerWhatsappHref,
} from "@/lib/admin/photographer-contact-links";

function MapBoundsController({
  points,
  showAll,
  radiusSearch,
}: {
  points: [number, number][];
  showAll: boolean;
  radiusSearch?: MapRadiusSearch | null;
}) {
  const map = useMap();
  useEffect(() => {
    let cancelled = false;

    const applyBounds = () => {
      if (cancelled) return;

      if (radiusSearch) {
        map.setMaxBounds(undefined);
        const box = boundingBoxForRadiusKm(
          radiusSearch.lat,
          radiusSearch.lng,
          radiusSearch.radiusKm
        );
        const bounds = L.latLngBounds(
          [box.south, box.west],
          [box.north, box.east]
        );
        if (points.length > 0) {
          map.fitBounds(bounds.extend(L.latLngBounds(points)), {
            padding: [48, 48],
            maxZoom: 12,
          });
        } else {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
        }
        return;
      }

      map.setMaxBounds(L.latLngBounds(ARGENTINA_BOUNDS));
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points), {
          padding: [48, 48],
          maxZoom: showAll ? 12 : 6,
        });
      } else {
        map.setView(ARGENTINA_CENTER, ARGENTINA_DEFAULT_ZOOM);
      }
    };

    map.whenReady(() => {
      applyBounds();
    });

    return () => {
      cancelled = true;
    };
  }, [map, points, showAll, radiusSearch]);
  return null;
}

type PhotographersArgentinaMapProps = {
  photographers: PhotographerMapPoint[];
  showOutsideArgentina?: boolean;
  radiusSearch?: MapRadiusSearch | null;
  height?: string;
  className?: string;
};

export default function PhotographersArgentinaMap({
  photographers,
  showOutsideArgentina = false,
  radiusSearch = null,
  height = "min(70vh, 640px)",
  className = "",
}: PhotographersArgentinaMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const visible = useMemo(
    () =>
      showOutsideArgentina
        ? photographers
        : photographers.filter((p) => p.inArgentina),
    [photographers, showOutsideArgentina]
  );

  const positions = useMemo(
    (): [number, number][] => visible.map((p) => [p.latitude, p.longitude]),
    [visible]
  );

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-[#e5e7eb] bg-[#f3f4f6] text-sm text-[#6b7280] ${className}`}
        style={{ height }}
      >
        Cargando mapa…
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#e5e7eb] z-0 ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={ARGENTINA_CENTER}
        zoom={ARGENTINA_DEFAULT_ZOOM}
        scrollWheelZoom
        minZoom={3}
        maxZoom={14}
        style={{ height: "100%", width: "100%" }}
      >
        <MapBoundsController
          points={positions}
          showAll={visible.length <= 3}
          radiusSearch={radiusSearch}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {radiusSearch ? (
          <>
            <Circle
              center={[radiusSearch.lat, radiusSearch.lng]}
              radius={radiusSearch.radiusKm * 1000}
              pathOptions={{
                color: "#2563eb",
                fillColor: "#2563eb",
                fillOpacity: 0.08,
                weight: 2,
                dashArray: "6 6",
              }}
            />
            <CircleMarker
              center={[radiusSearch.lat, radiusSearch.lng]}
              radius={11}
              pathOptions={{
                color: "#1d4ed8",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <p className="font-semibold text-[#111827] m-0">Centro de búsqueda</p>
                  <p className="text-xs text-[#6b7280] mt-1 m-0">{radiusSearch.label}</p>
                  <p className="text-xs mt-1 m-0">Radio: {radiusSearch.radiusKm} km</p>
                </div>
              </Popup>
            </CircleMarker>
          </>
        ) : null}
        {visible.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.latitude, p.longitude]}
            radius={8}
            pathOptions={{
              color: p.inArgentina ? MARKER_COLOR : MARKER_COLOR_OUT,
              fillColor: p.inArgentina ? MARKER_COLOR : MARKER_COLOR_OUT,
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm min-w-[200px]">
                <p className="font-semibold text-[#111827] m-0">
                  {p.name || p.companyName || "Sin nombre"}
                </p>
                {p.companyName && p.name ? (
                  <p className="text-xs text-[#6b7280] mt-0.5 m-0">{p.companyName}</p>
                ) : null}
                <p className="text-xs text-[#6b7280] mt-1 m-0">{p.email}</p>
                {(() => {
                  const { addressLine, cityLine } = formatPhotographerWorkLocationParts(p);
                  if (!addressLine && !cityLine) return null;
                  return (
                    <div className="mt-1 space-y-0.5">
                      {addressLine ? <p className="text-xs m-0 leading-snug">{addressLine}</p> : null}
                      {cityLine ? (
                        <p className="text-xs text-[#6b7280] m-0 leading-snug">{cityLine}</p>
                      ) : null}
                    </div>
                  );
                })()}
                {p.whatsapp ? (
                  <p className="text-xs mt-1 m-0">
                    WhatsApp:{" "}
                    {photographerWhatsappHref(p.whatsapp) ? (
                      <a
                        href={photographerWhatsappHref(p.whatsapp)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#c27b3d] font-medium hover:underline"
                      >
                        {p.whatsapp}
                      </a>
                    ) : (
                      p.whatsapp
                    )}
                  </p>
                ) : null}
                {p.instagram ? (
                  <p className="text-xs mt-1 m-0">
                    Instagram:{" "}
                    {photographerInstagramHref(p.instagram) ? (
                      <a
                        href={photographerInstagramHref(p.instagram)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#c27b3d] font-medium hover:underline"
                      >
                        {photographerInstagramLabel(p.instagram)}
                      </a>
                    ) : (
                      p.instagram
                    )}
                  </p>
                ) : null}
                {p.distanceKm != null ? (
                  <p className="text-xs font-medium text-[#2563eb] mt-1 m-0">~{p.distanceKm} km del centro</p>
                ) : null}
                <p className="text-[10px] text-[#9ca3af] mt-2 m-0 font-mono">
                  {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                </p>
                <a
                  href={`/admin/usuarios/${p.id}`}
                  className="inline-block mt-2 text-xs font-medium text-[#c27b3d] hover:underline"
                >
                  Ver en admin →
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
