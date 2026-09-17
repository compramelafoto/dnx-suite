"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  coordenadasLegibles,
  direccionDeLugar,
  type Lugar,
} from "@/lib/geocode/lugar";

/**
 * El lugar del evento: la dirección escrita, y el pin que saca la duda.
 *
 * **El pin es lo esencial, no el autocompletado.** Una dirección bien escrita igual es ambigua:
 * un predio puede tener tres accesos y la entrada estar por el fondo. Que la organización
 * confirme el punto es lo que elimina la confusión para quien va a cubrir.
 *
 * Tres cuidados que decidieron la forma de esta pantalla:
 *
 * 1. **La dirección se sigue escribiendo a mano.** El campo es un `input` común con su `name`
 *    de siempre; el buscador sugiere, no impone. Si Nominatim no encuentra el lugar —pasa en
 *    pueblos chicos— el pedido se manda igual. El punto es opcional; la dirección, no (o sí,
 *    según lo que haya configurado la institución).
 * 2. **Se completa desde el teléfono, con datos móviles y una mano.** El mapa arranca cerrado y
 *    Leaflet ni siquiera se descarga hasta que alguien lo abre: son unos 150 KB que no se le
 *    cobran a quien no los usa. Abierto mide 220 px y queda debajo del campo, no encima.
 * 3. **El punto nunca pisa lo escrito.** Cuando se mueve el pin se ofrece la dirección de ese
 *    punto con un botón, y la persona decide. Reemplazar sola una dirección que alguien tipeó
 *    es la forma más rápida de perder el dato bueno.
 *
 * `LocationSearch` de `@repo/geo/react` no se puede usar acá: trae su propio `<form>` adentro, y
 * este control vive dentro del `<form>` del formulario público —un formulario anidado es HTML
 * inválido y rompe el envío—. Es el mismo motivo por el que CompraMeLaFoto escribió sus propios
 * `EventLocationSearch` y `AddressGeoSearch`. Lo que sí se comparte es el contrato:
 * `NormalizedPlace` viaja del proxy hasta acá con los nombres del DNX GEO ENGINE.
 */

const MapaDelLugar = dynamic(() => import("./mapa-del-lugar"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] text-sm text-[var(--fo-muted)]">
      Cargando el mapa…
    </div>
  ),
});

/** Lo que se espera desde el último tecleo antes de molestar a Nominatim. */
const ESPERA_MS = 500;
const MINIMO = 3;

type Punto = { lat: number; lon: number };

export function UbicacionDelEvento({
  name,
  label,
  hint,
  required,
  clasesControl,
}: {
  /** El `name` del campo de dirección. Es la clave del catálogo (`addressLine`). */
  name: string;
  label: string;
  hint?: string;
  required: boolean;
  /** Las mismas clases que el resto de los campos del formulario público. */
  clasesControl: string;
}) {
  const [direccion, setDireccion] = useState("");
  const [punto, setPunto] = useState<Punto | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);

  const [sugerencias, setSugerencias] = useState<Lugar[]>([]);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /** La dirección que Nominatim dice que hay en el punto actual. Se ofrece, no se aplica. */
  const [direccionDelPunto, setDireccionDelPunto] = useState<string | null>(null);

  /** Lo último que se eligió o se leyó del mapa: no se vuelve a buscar solo. */
  const yaResuelto = useRef<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const abortarBusqueda = useRef<AbortController | null>(null);
  const abortarReverso = useRef<AbortController | null>(null);

  /** Cerrar la lista al tocar afuera. Sin esto queda tapando los campos de abajo. */
  useEffect(() => {
    function afuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setListaAbierta(false);
      }
    }
    document.addEventListener("mousedown", afuera);
    return () => document.removeEventListener("mousedown", afuera);
  }, []);

  const buscar = useCallback(async (q: string) => {
    abortarBusqueda.current?.abort();
    const control = new AbortController();
    abortarBusqueda.current = control;
    setBuscando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: control.signal,
      });
      if (!res.ok) {
        // Nunca se frena a la persona: la dirección escrita alcanza. El aviso explica por qué no
        // aparecen sugerencias, así nadie se queda esperando una lista que no va a llegar.
        setSugerencias([]);
        setAviso("No pudimos buscar la dirección. Escribila a mano y seguí.");
        return;
      }
      const datos: unknown = await res.json();
      const lista = Array.isArray(datos) ? (datos as Lugar[]) : [];
      setSugerencias(lista);
      setListaAbierta(lista.length > 0);
      if (lista.length === 0) {
        setAviso("No encontramos ese lugar. Escribí la dirección como la sepas y marcá el punto en el mapa.");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setSugerencias([]);
      setAviso("No pudimos buscar la dirección. Escribila a mano y seguí.");
    } finally {
      setBuscando(false);
    }
  }, []);

  /** Busca sola mientras se escribe, con una espera para no pedir una búsqueda por tecla. */
  useEffect(() => {
    const q = direccion.trim();
    if (q.length < MINIMO || q === yaResuelto.current) {
      setSugerencias([]);
      setListaAbierta(false);
      return;
    }
    const reloj = setTimeout(() => void buscar(q), ESPERA_MS);
    return () => clearTimeout(reloj);
  }, [direccion, buscar]);

  /** Qué dirección hay donde quedó el pin. Se pregunta después de soltarlo, no mientras se mueve. */
  useEffect(() => {
    if (!punto) {
      setDireccionDelPunto(null);
      return;
    }
    const reloj = setTimeout(async () => {
      abortarReverso.current?.abort();
      const control = new AbortController();
      abortarReverso.current = control;
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${punto.lat}&lon=${punto.lon}`, {
          signal: control.signal,
        });
        if (!res.ok) return;
        const datos: unknown = await res.json();
        setDireccionDelPunto(datos ? direccionDeLugar(datos as Lugar) : null);
      } catch {
        // Silencio a propósito: es una comodidad. Que falle no cambia nada de lo que se guarda.
      }
    }, 700);
    return () => clearTimeout(reloj);
  }, [punto]);

  function elegirSugerencia(lugar: Lugar) {
    const texto = direccionDeLugar(lugar);
    yaResuelto.current = texto;
    setDireccion(texto);
    setPunto({ lat: lugar.latitude, lon: lugar.longitude });
    setDireccionDelPunto(null);
    setSugerencias([]);
    setListaAbierta(false);
    setAviso(null);
    setMapaAbierto(true);
  }

  function moverPin(lat: number, lon: number) {
    setPunto({ lat, lon });
  }

  function usarDireccionDelPunto() {
    if (!direccionDelPunto) return;
    yaResuelto.current = direccionDelPunto;
    setDireccion(direccionDelPunto);
    setDireccionDelPunto(null);
  }

  const idCampo = `${name}-direccion`;

  return (
    <div ref={contenedor} className="space-y-2">
      <label className="block space-y-1.5" htmlFor={idCampo}>
        <span className="text-sm font-medium">
          {label}
          {required ? " *" : ""}
        </span>
        <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">
          {hint ??
            "Escribila y elegí de la lista si aparece. Si no aparece, escribila igual: con el mapa de abajo podés marcar la entrada exacta."}
        </span>
      </label>

      <div className="relative">
        <input
          id={idCampo}
          name={name}
          type="text"
          value={direccion}
          onChange={(e) => {
            setDireccion(e.target.value);
            setAviso(null);
          }}
          onFocus={() => sugerencias.length > 0 && setListaAbierta(true)}
          required={required}
          autoComplete="off"
          className={clasesControl}
        />
        {buscando ? (
          <p className="mt-1 text-xs text-[var(--fo-muted)]">Buscando…</p>
        ) : null}

        {listaAbierta && sugerencias.length > 0 ? (
          // `z-20`, por encima de todo lo que sigue en el formulario pero por debajo de nada:
          // el mapa lleva `z-0` justamente para no taparla.
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] shadow-lg">
            {sugerencias.map((lugar, i) => (
              <li key={lugar.placeId ?? `${lugar.latitude},${lugar.longitude},${i}`}>
                <button
                  type="button"
                  onClick={() => elegirSugerencia(lugar)}
                  className="w-full border-b border-[var(--fo-border)] px-3 py-3 text-left text-sm leading-snug last:border-0 hover:bg-[var(--fo-surface-hover)]"
                >
                  {lugar.displayName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {aviso ? (
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">{aviso}</p>
      ) : null}

      {/*
        Los dos únicos datos que viajan al servidor además de la dirección. Vacíos cuando no hay
        punto: `parseCoverageRequest` los lee con `validateCoordinates` y un vacío queda en nulo.
      */}
      <input type="hidden" name="latitude" value={punto ? String(punto.lat) : ""} />
      <input type="hidden" name="longitude" value={punto ? String(punto.lon) : ""} />

      {!mapaAbierto ? (
        <button
          type="button"
          onClick={() => setMapaAbierto(true)}
          className="fo-btn fo-btn-secondary min-h-11 w-full text-sm"
        >
          {punto ? "Ver y ajustar el punto en el mapa" : "Marcar el punto en el mapa (opcional)"}
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
            {punto
              ? "Arrastrá el pin —o tocá el mapa— hasta la entrada por donde se llega de verdad."
              : "Tocá el mapa donde queda el lugar. Movelo y acercalo hasta encontrarlo."}
          </p>
          <MapaDelLugar
            latitude={punto?.lat ?? null}
            longitude={punto?.lon ?? null}
            editable
            onMover={moverPin}
          />

          {punto ? (
            <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] p-3">
              <p className="text-xs leading-relaxed">
                <span className="font-medium">Punto marcado.</span>{" "}
                <span className="text-[var(--fo-muted)] tabular-nums">
                  {coordenadasLegibles(punto.lat, punto.lon)}
                </span>
              </p>
              {direccionDelPunto && direccionDelPunto !== direccion.trim() ? (
                <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
                  Ahí dice «{direccionDelPunto}».{" "}
                  <button
                    type="button"
                    onClick={usarDireccionDelPunto}
                    className="font-medium text-[var(--fo-accent)] underline"
                  >
                    Usar esa dirección
                  </button>
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPunto(null);
                  setDireccionDelPunto(null);
                }}
                className="fo-btn fo-btn-ghost min-h-11 text-sm"
              >
                Quitar el punto
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setMapaAbierto(false)}
            className="fo-btn fo-btn-ghost min-h-11 text-sm"
          >
            Cerrar el mapa
          </button>
        </div>
      )}
    </div>
  );
}
