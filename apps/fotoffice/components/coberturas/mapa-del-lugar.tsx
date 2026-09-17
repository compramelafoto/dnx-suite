"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * El mapa con el pin.
 *
 * **Vive en la aplicación y no en `@repo/geo` a propósito**: el propio paquete lo dice en
 * `src/react/index.ts` —el buscador y los resúmenes son compartibles, el mapa no, porque depende
 * de los assets del marcador, de la hoja de estilos de Leaflet y del tono de cada marca—. Es el
 * mismo reparto que hizo CompraMeLaFoto con `components/organizer/LocationMap.tsx`, de donde
 * sale esta pantalla.
 *
 * Sólo en el navegador: Leaflet toca `window` al cargarse. Quien lo use tiene que importarlo con
 * `next/dynamic` y `ssr: false` (ver `ubicacion-del-evento.tsx`).
 */

/** Buenos Aires. Es dónde mirar cuando todavía no hay ningún punto. */
const CENTRO_POR_OMISION: [number, number] = [-34.6037, -58.3816];

/** Cerca, cuando hay un punto: lo que importa es ver la esquina, no la provincia. */
const ZOOM_CON_PUNTO = 16;
/** Lejos, cuando no hay ninguno: se ve el país entero y la persona busca su zona. */
const ZOOM_SIN_PUNTO = 4;

type PosicionHandlers = {
  editable: boolean;
  onMover?: (lat: number, lng: number) => void;
};

/** Tocar el mapa mueve el pin. En un teléfono es más fácil que arrastrarlo. */
function ClicEnElMapa({ editable, onMover }: PosicionHandlers) {
  useMapEvents({
    click(e) {
      if (!editable || !onMover) return;
      onMover(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Recentra cuando el punto cambia desde afuera (una dirección elegida en el buscador).
 *
 * No recentra cuando el punto cambió por arrastrar el pin: en ese caso el mapa ya está donde
 * tiene que estar y moverlo solo se siente como que la pantalla se resiste.
 */
function Recentrar({ lat, lng }: { lat: number | null; lng: number | null }) {
  const mapa = useMap();
  const posicion = useMemo(
    () => (lat != null && lng != null ? ([lat, lng] as [number, number]) : null),
    [lat, lng],
  );
  useEffect(() => {
    if (!posicion) return;
    mapa.setView(posicion, Math.max(mapa.getZoom(), ZOOM_CON_PUNTO));
  }, [mapa, posicion]);
  return null;
}

export type MapaDelLugarProps = {
  latitude: number | null;
  longitude: number | null;
  /** Si se puede mover el pin. La ficha de la solicitud lo muestra quieto. */
  editable?: boolean;
  onMover?: (lat: number, lng: number) => void;
  alto?: string;
};

export default function MapaDelLugar({
  latitude,
  longitude,
  editable = false,
  onMover,
  alto = "220px",
}: MapaDelLugarProps) {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    // Leaflet arma la ruta de sus iconos a partir de dónde cree que está su CSS, y con un
    // empaquetador esa deducción falla: sin esto el pin no se ve. Los tres archivos viven en
    // `public/leaflet/`.
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "/leaflet/marker-icon.png",
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      shadowUrl: "/leaflet/marker-shadow.png",
    });
    setListo(true);
  }, []);

  const arrastrar = useCallback(
    (e: L.LeafletEvent) => {
      if (!editable || !onMover) return;
      const p = (e.target as L.Marker).getLatLng();
      onMover(p.lat, p.lng);
    },
    [editable, onMover],
  );

  const hayPunto = latitude != null && longitude != null;
  const centro: [number, number] = hayPunto ? [latitude, longitude] : CENTRO_POR_OMISION;

  if (!listo) {
    return (
      <div
        className="flex items-center justify-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-sm text-[var(--fo-muted)]"
        style={{ height: alto }}
      >
        Cargando el mapa…
      </div>
    );
  }

  return (
    // `z-0` no es decorativo: los paneles de Leaflet traen su propio `z-index` alto y sin esto
    // el mapa se dibuja por encima de la lista de sugerencias del buscador.
    <div
      className="relative z-0 overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]"
      style={{ height: alto }}
    >
      <MapContainer
        center={centro}
        zoom={hayPunto ? ZOOM_CON_PUNTO : ZOOM_SIN_PUNTO}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClicEnElMapa editable={editable} onMover={onMover} />
        <Recentrar lat={latitude} lng={longitude} />
        {hayPunto ? (
          <Marker
            position={[latitude, longitude]}
            draggable={editable}
            eventHandlers={editable ? { dragend: arrastrar } : undefined}
            alt="El lugar del evento"
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
