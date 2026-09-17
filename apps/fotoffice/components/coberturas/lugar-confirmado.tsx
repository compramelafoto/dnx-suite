"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { coordenadasLegibles, enlaceDeMapa } from "@/lib/geocode/lugar";

/**
 * El lugar, tal como lo necesita quien va a cubrir.
 *
 * Tres cosas, en este orden de importancia: la dirección escrita, un enlace que abre el punto en
 * la aplicación de mapas del teléfono, y el mapa para mirarlo sin salir de la pantalla.
 *
 * **El enlace va primero y siempre visible.** Quien va a cubrir un evento no quiere ver un mapa:
 * quiere apretar algo que le diga cómo llegar. El mapa arranca cerrado —Leaflet son unos 150 KB
 * que no tiene sentido cobrarle a quien sólo vino a leer la hora— y se abre si alguien lo pide.
 *
 * Sin punto no se dibuja nada de esto: queda la dirección sola, que es lo que había antes. Las
 * 66 solicitudes y 51 coberturas que ya estaban cargadas se ven exactamente igual que siempre.
 */

const MapaDelLugar = dynamic(() => import("./mapa-del-lugar"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-sm text-[var(--fo-muted)]">
      Cargando el mapa…
    </div>
  ),
});

export function LugarConfirmado({
  direccion,
  latitude,
  longitude,
}: {
  /** La dirección y la localidad, ya armadas por la pantalla. */
  direccion: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const hayPunto = latitude != null && longitude != null;

  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed">{direccion}</p>

      {hayPunto ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={enlaceDeMapa(latitude, longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="fo-btn fo-btn-secondary min-h-11 text-sm"
            >
              Cómo llegar
            </a>
            <button
              type="button"
              onClick={() => setMapaAbierto((a) => !a)}
              className="fo-btn fo-btn-ghost min-h-11 text-sm"
            >
              {mapaAbierto ? "Ocultar el mapa" : "Ver el mapa"}
            </button>
          </div>
          <p className="text-xs text-[var(--fo-muted-soft)]">
            {/*
              Las coordenadas a la vista, y no sólo detrás del enlace: es el dato que alguien
              copia y pega en el teléfono de otra persona, o pasa por WhatsApp a quien va a ir.
            */}
            Punto confirmado por la organización ·{" "}
            <span className="select-all tabular-nums">
              {coordenadasLegibles(latitude, longitude)}
            </span>
          </p>
          {mapaAbierto ? (
            <MapaDelLugar latitude={latitude} longitude={longitude} alto="220px" />
          ) : null}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-[var(--fo-muted-soft)]">
          Sin punto en el mapa: hay que llegar con la dirección escrita.
        </p>
      )}
    </div>
  );
}
