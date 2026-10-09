"use client";

import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
});

export type PuntoMapa = { slug: string; title: string; latitude: number; longitude: number; etiqueta: string; lugar?: string | null };

/**
 * Centro de Argentina con zoom de país. Sólo en el navegador: importar con `ssr: false`.
 * Ocupa todo el alto de quien lo contiene.
 */
export default function MapaNacional({ puntos }: { puntos: PuntoMapa[] }) {
  return (
    <div className="relative z-0 h-full overflow-hidden rounded-2xl border border-[var(--mf-line)]">
      <MapContainer center={[-38.4, -63.6]} zoom={4} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
