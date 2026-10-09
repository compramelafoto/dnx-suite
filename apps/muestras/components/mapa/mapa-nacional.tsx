"use client";

import Link from "next/link";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

/** El país entero, de La Quiaca a Ushuaia. Es lo que se ve cuando no hay ningún punto. */
const ARGENTINA: L.LatLngBoundsExpression = [[-55.2, -73.7], [-21.7, -53.5]];
/** Con un solo punto (o varios en la misma cuadra) no se acerca más que esto. */
const ZOOM_MAXIMO_AL_ENCUADRAR = 12;

/** Encuadra los puntos; si no hay, el país. Se vuelve a encuadrar cuando cambian los filtros. */
function Encuadre({ puntos }: { puntos: PuntoMapa[] }) {
  const mapa = useMap();
  const clave = puntos.map((p) => `${p.latitude},${p.longitude}`).join("|");
  useEffect(() => {
    if (puntos.length === 0) {
      mapa.fitBounds(ARGENTINA);
      return;
    }
    const limites = L.latLngBounds(puntos.map((p) => [p.latitude, p.longitude] as [number, number]));
    mapa.fitBounds(limites, { padding: [40, 40], maxZoom: ZOOM_MAXIMO_AL_ENCUADRAR });
    // `clave` resume los puntos: el arreglo cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, clave]);
  return null;
}

export type PuntoMapa = { slug: string; title: string; latitude: number; longitude: number; etiqueta: string; lugar?: string | null };

/**
 * Centro de Argentina con zoom de país. Sólo en el navegador: importar con `ssr: false`.
 * Ocupa todo el alto de quien lo contiene.
 */
export default function MapaNacional({ puntos }: { puntos: PuntoMapa[] }) {
  return (
    <div className="relative z-0 h-full overflow-hidden rounded-2xl border border-[var(--mf-line)]">
      <MapContainer bounds={ARGENTINA} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Encuadre puntos={puntos} />
        {puntos.map((p) => (
          <Marker key={p.slug} position={[p.latitude, p.longitude]} alt={p.title}>
            <Popup>
              <Link href={`/m/${p.slug}`} className="mf-globo-titulo">{p.title}</Link>
              <br />
              {p.etiqueta}
              {p.lugar ? <><br />{p.lugar}</> : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
