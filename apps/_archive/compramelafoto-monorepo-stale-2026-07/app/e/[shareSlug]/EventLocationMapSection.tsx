"use client";

import dynamic from "next/dynamic";

const EventLocationMap = dynamic(
  () => import("@/components/organizer/EventLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl bg-gray-200 h-[240px] flex items-center justify-center text-gray-500 text-sm">
        Cargando mapa…
      </div>
    ),
  }
);

type Props = {
  latitude: number;
  longitude: number;
  locationName?: string | null;
};

export default function EventLocationMapSection({
  latitude,
  longitude,
  locationName,
}: Props) {
  const hasCoords = (latitude !== 0 || longitude !== 0) && Number.isFinite(latitude) && Number.isFinite(longitude);
  if (!hasCoords) return null;

  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Ubicación</h2>
      <div className="rounded-xl overflow-hidden border border-gray-200 mb-2">
        <EventLocationMap
          latitude={latitude}
          longitude={longitude}
          editable={false}
          height="240px"
        />
      </div>
      <p className="text-sm text-gray-600 mb-2 break-words min-w-0">
        {locationName && <span className="font-medium">{locationName}</span>}
        {locationName && " · "}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#c27b3d] hover:underline"
        >
          Ver en Google Maps
        </a>
        {" · "}
        <a
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#c27b3d] hover:underline"
        >
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}
