"use client";

import dynamic from "next/dynamic";
import type { Centro, PuntoMapa } from "./mapa-nacional";

/** Mientras Leaflet carga se ve una superficie quieta del mismo tamaño: nada salta. */
const Mapa = dynamic(() => import("./mapa-nacional"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--mf-surface)]" />,
});

/** Ocupa todo el alto de quien lo contiene: el alto lo decide la portada. */
export function MapaNacionalCliente({ puntos, centro }: { puntos: PuntoMapa[]; centro?: Centro | null }) {
  return <Mapa puntos={puntos} centro={centro} />;
}
