"use client";

import EventLocationSearch from "@/components/organizer/EventLocationSearch";
import {
  computeDistanceKm,
  hasValidCoords,
  parseCoord,
} from "@/lib/cuantocobro/job-distance";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type WorkBase = {
  lat: number;
  lng: number;
  label: string;
};

type Props = {
  location: string;
  latitude: string;
  longitude: string;
  onLocationChange: (address: string, lat: number, lon: number) => void;
  onClear: () => void;
};

export default function CuantoCobroJobLocationSearch({
  location,
  latitude,
  longitude,
  onLocationChange,
  onClear,
}: Props) {
  const [workBase, setWorkBase] = useState<WorkBase | null>(null);
  const [loadingBase, setLoadingBase] = useState(true);

  const jobLat = parseCoord(latitude);
  const jobLng = parseCoord(longitude);
  const hasJobCoords = hasValidCoords(jobLat, jobLng);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkBase() {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (!meRes.ok) return;
        const meData = await meRes.json();
        const userId = meData?.user?.id;
        if (!userId) return;

        const profileRes = await fetch(`/api/fotografo/${userId}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!profileRes.ok) return;
        const profile = await profileRes.json();
        const lat = parseCoord(profile?.latitude != null ? String(profile.latitude) : null);
        const lng = parseCoord(profile?.longitude != null ? String(profile.longitude) : null);
        if (!hasValidCoords(lat, lng)) return;

        const label =
          [profile?.address, profile?.city].filter(Boolean).join(", ") || "Tu ubicación de trabajo";

        if (!cancelled) {
          setWorkBase({ lat: lat!, lng: lng!, label });
        }
      } catch {
        /* sin base configurada */
      } finally {
        if (!cancelled) setLoadingBase(false);
      }
    }

    void loadWorkBase();
    return () => {
      cancelled = true;
    };
  }, []);

  const distanceKm = useMemo(() => {
    if (!workBase || !hasJobCoords) return null;
    return computeDistanceKm(workBase.lat, workBase.lng, jobLat!, jobLng!);
  }, [workBase, hasJobCoords, jobLat, jobLng]);

  return (
    <div className="cc-job-location">
      <EventLocationSearch
        value={location}
        onSelect={(lat, lon, displayName) => onLocationChange(displayName, lat, lon)}
        onClear={onClear}
        placeholder="Ciudad, salón, dirección"
        className="cc-job-location__search"
      />

      {hasJobCoords ? (
        <p className="cc-job-location__confirmed m-0" role="status">
          Dirección georeferenciada
          {distanceKm != null ? (
            <>
              {" "}
              · <strong>~{distanceKm} km</strong> desde tu base
            </>
          ) : null}
        </p>
      ) : null}

      {!loadingBase && !workBase ? (
        <p className="cc-job-location__hint m-0">
          Para calcular la distancia automáticamente, configurá tu{" "}
          <Link href="/fotografo/configuracion" className="cc-job-location__link">
            ubicación de trabajo en ComprameLaFoto
          </Link>
          .
        </p>
      ) : null}

      {!loadingBase && workBase && !hasJobCoords && location.trim() ? (
        <p className="cc-job-location__hint m-0">
          Elegí una opción de la lista para guardar las coordenadas y calcular la distancia.
        </p>
      ) : null}
    </div>
  );
}
