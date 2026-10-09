"use client";

import dynamic from "next/dynamic";
import type { PuntoMapa } from "./mapa-nacional";

const Mapa = dynamic(() => import("./mapa-nacional"), { ssr: false, loading: () => <div className="h-[60vh] min-h-80 rounded-md bg-[var(--mf-line)]" /> });

export function MapaNacionalCliente({ puntos }: { puntos: PuntoMapa[] }) {
  return <Mapa puntos={puntos} />;
}
