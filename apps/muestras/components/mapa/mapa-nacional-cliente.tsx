"use client";

import dynamic from "next/dynamic";
import type { PuntoMapa } from "./mapa-nacional";

/** Mientras Leaflet carga se ve una superficie quieta del mismo tamaño: nada salta. */
const Mapa = dynamic(() => import("./mapa-nacional"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-2xl border border-[var(--mf-line)] bg-[var(--mf-surface)]" />,
});

/** Ocupa todo el alto de quien lo contiene: el alto lo decide la portada. */
export function MapaNacionalCliente({ puntos }: { puntos: PuntoMapa[] }) {
  return <Mapa puntos={puntos} />;
}
