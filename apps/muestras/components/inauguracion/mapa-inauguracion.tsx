"use client";

import dynamic from "next/dynamic";

// Leaflet toca `window` al cargarse: sólo en el navegador.
const MapaDelLugar = dynamic(() => import("@/components/mapa/mapa-del-lugar"), { ssr: false });

export function MapaInauguracion({ latitude, longitude }: { latitude: number; longitude: number }) {
  return <MapaDelLugar latitude={latitude} longitude={longitude} alto="240px" />;
}
