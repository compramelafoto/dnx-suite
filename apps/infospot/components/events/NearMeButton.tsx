"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { NEAR_ME_RADIUS_KM } from "@/lib/geo";

type Props = {
  active?: boolean;
};

export function NearMeButton({ active = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function clearNearMe() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("lat");
    next.delete("lng");
    next.delete("radio");
    startTransition(() => {
      router.push(`/eventos?${next.toString()}`);
    });
  }

  function locate() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Tu navegador no permite geolocalización.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("lat", pos.coords.latitude.toFixed(5));
        next.set("lng", pos.coords.longitude.toFixed(5));
        next.set("radio", String(NEAR_ME_RADIUS_KM));
        startTransition(() => {
          router.push(`/eventos?${next.toString()}`);
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Necesitamos permiso de ubicación para buscar cerca tuyo.");
        } else {
          setError("No pudimos obtener tu ubicación. Probá de nuevo.");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {active ? (
        <button
          type="button"
          onClick={clearNearMe}
          disabled={pending}
          className="min-h-11 px-4 text-sm font-medium text-[var(--is-accent)] ring-1 ring-[var(--is-accent)] disabled:opacity-60"
        >
          {pending ? "Actualizando…" : "Quitar ubicación"}
        </button>
      ) : (
        <button
          type="button"
          onClick={locate}
          disabled={pending}
          className="min-h-11 px-4 text-sm font-medium ring-1 ring-[var(--is-border)] hover:ring-[var(--is-graphite-400)] disabled:opacity-60"
        >
          {pending ? "Buscando…" : "Buscar por mi ubicación"}
        </button>
      )}
      {error ? (
        <p className="max-w-[16rem] text-xs text-amber-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
