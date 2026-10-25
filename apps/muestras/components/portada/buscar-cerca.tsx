"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { isInServiceArea, nearHref } from "@repo/muestras";
import { buscarCerca, type EstadoBusquedaCerca } from "@/lib/portada/buscar-cerca";

const INICIAL: EstadoBusquedaCerca = { error: null };

/**
 * "Buscá muestras cerca tuyo", sobre la foto de la portada. El texto lo ubica el servidor
 * (`buscarCerca`); "Usar mi ubicación" le pide la posición al navegador recién al tocarlo.
 * Las dos terminan en `/?cerca=…&lugar=…#muestras`.
 */
export function BuscarCerca() {
  const router = useRouter();
  const [estado, buscar, buscando] = useActionState(buscarCerca, INICIAL);
  const [ubicando, setUbicando] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const error = errorUbicacion ?? estado.error;

  function usarMiUbicacion() {
    setErrorUbicacion(null);
    if (!("geolocation" in navigator)) {
      setErrorUbicacion("Este navegador no comparte la ubicación. Escribí tu ciudad.");
      return;
    }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicando(false);
        const punto = { latitude: coords.latitude, longitude: coords.longitude };
        if (!isInServiceArea(punto)) {
          setErrorUbicacion("Tu ubicación queda lejos de las muestras publicadas. Escribí una ciudad.");
          return;
        }
        router.push(nearHref(punto, "tu ubicación"));
      },
      () => {
        setUbicando(false);
        setErrorUbicacion("No pudimos saber dónde estás. Escribí tu ciudad.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  return (
    <form action={buscar} role="search" aria-labelledby="titulo-buscar-cerca" className="mt-6 max-w-[34rem]" onSubmit={() => setErrorUbicacion(null)}>
      <label id="titulo-buscar-cerca" htmlFor="buscar-cerca" className="block text-[15px] font-medium">Buscá muestras cerca tuyo</label>
      <div className="mt-2 flex gap-2">
        <input
          id="buscar-cerca"
          name="q"
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder="Ciudad o dirección"
          required
          minLength={3}
          maxLength={60}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "error-buscar-cerca" : undefined}
          className="h-11 min-w-0 flex-1 border border-white/80 bg-white px-3 text-[15px] text-[var(--mf-ink)] placeholder:text-[var(--mf-muted)]"
        />
        <button
          type="submit"
          disabled={buscando}
          className="inline-flex h-11 shrink-0 items-center border border-white/80 px-5 text-[15px] transition-colors hover:bg-white hover:text-[var(--mf-ink)] disabled:opacity-70"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>
      <button
        type="button"
        onClick={usarMiUbicacion}
        disabled={ubicando}
        className="mt-3 text-[15px] underline decoration-white/50 underline-offset-[6px] hover:decoration-white disabled:opacity-70"
      >
        {ubicando ? "Buscando tu ubicación…" : "Usar mi ubicación"}
      </button>
      <p id="error-buscar-cerca" role="status" aria-live="polite" className="mt-2 min-h-0 text-[15px] text-white">
        {error}
      </p>
    </form>
  );
}
