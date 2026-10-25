"use client";

import dynamic from "next/dynamic";

const LocationMap = dynamic(() => import("@/components/organizer/LocationMap"), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-xl bg-gray-100" />,
});

/** Tocá el mapa para marcar el punto. Sin punto, arranca en Buenos Aires. */
export default function AgencyMapPicker({
  lat,
  lng,
  onChange,
  height = "260px",
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
      <LocationMap latitude={lat ?? 0} longitude={lng ?? 0} editable onPositionChange={onChange} height={height} />
    </div>
  );
}
