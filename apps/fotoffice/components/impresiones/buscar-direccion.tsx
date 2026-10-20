"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { cotizarEnvio, type Punto } from "@/lib/impresiones/envio";

/** La dirección elegida de la lista, con su punto. Es lo único que viaja al servidor para el envío. */
export type DireccionElegida = { direccion: string; lat: number; lon: number };
type Resultado = { latitude: number; longitude: number; displayName: string };

const ESPERA_MS = 500;
const MIN_LETRAS = 3;
const MAX_RESULTADOS = 5;
const MAX_DIRECCION = 300;
const ERROR_BUSQUEDA = "No pudimos buscar la dirección. Probá de nuevo en un momento.";
const ENTERO = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const CON_CENTAVOS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const plata = (cents: number) => (cents % 100 === 0 ? ENTERO : CON_CENTAVOS).format(cents / 100);
const km = (n: number) => String(n).replace(".", ",");

/**
 * Buscador de la dirección de envío: escribe, espera medio segundo y le pregunta a `/api/geocode` (nuestro proxy
 * de Nominatim). Al elegir un resultado devuelve la dirección y su punto por `onElegir`, y muestra el costo con la
 * misma cuenta que el servidor (acá es sólo informativo: el que vale se calcula al pagar).
 */
export function BuscarDireccion({
  envio,
  elegida,
  onElegir,
}: {
  envio: { baseCents: number; porKmCents: number; maxKm: number | null; estudio: Punto };
  elegida: DireccionElegida | null;
  onElegir: (d: DireccionElegida | null) => void;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La última búsqueda que respondió: el aviso «no aparece» sólo después de buscar ese texto.
  const [buscado, setBuscado] = useState<string | null>(null);
  const abortar = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = texto.trim();
    abortar.current?.abort();
    if (elegida || q.length < MIN_LETRAS) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    const reloj = setTimeout(async () => {
      const control = new AbortController();
      abortar.current = control;
      setBuscando(true);
      setError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: control.signal });
        if (!res.ok) {
          setResultados([]);
          // 400 = texto corto: no es un error para mostrar.
          if (res.status !== 400) setError(ERROR_BUSQUEDA);
          return;
        }
        const datos = (await res.json()) as unknown;
        const lista = Array.isArray(datos) ? (datos as Resultado[]) : [];
        setResultados(lista.filter((r) => typeof r?.displayName === "string").slice(0, MAX_RESULTADOS));
        setBuscado(q);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setError(ERROR_BUSQUEDA);
      } finally {
        if (abortar.current === control) setBuscando(false);
      }
    }, ESPERA_MS);
    return () => clearTimeout(reloj);
  }, [texto, elegida]);

  useEffect(() => () => abortar.current?.abort(), []);

  function elegir(r: Resultado) {
    setResultados([]);
    setTexto("");
    onElegir({ direccion: r.displayName.trim().slice(0, MAX_DIRECCION), lat: r.latitude, lon: r.longitude });
  }

  if (elegida) {
    const q = cotizarEnvio({ ...envio, destino: { lat: elegida.lat, lon: elegida.lon } });
    return (
      <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--fo-accent)]" aria-hidden />
            <span className="break-words">{elegida.direccion}</span>
          </p>
          <button type="button" className="fo-btn fo-btn-ghost shrink-0 gap-1 px-2 text-xs" onClick={() => onElegir(null)} aria-label="Cambiar la dirección">
            <X className="size-4" aria-hidden />
            Cambiar
          </button>
        </div>
        <p role="status" className={q.ok ? "text-[var(--fo-text-secondary)]" : "text-amber-800"}>
          {q.ok
            ? `Envío: ${plata(q.cents)} (${km(q.km)} km)`
            : "Esa dirección está fuera de la zona de envío. Elegí retirar en el local u otra dirección."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="fo-label">Dirección de envío</span>
        <input
          className="fo-input w-full"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Calle, número y ciudad"
          autoComplete="street-address"
          maxLength={MAX_DIRECCION}
        />
      </label>
      {buscando ? <p className="text-xs text-[var(--fo-muted)]">Buscando…</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {resultados.length > 0 ? (
        <ul className="divide-y divide-[var(--fo-border)] rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]" aria-label="Direcciones encontradas">
          {resultados.map((r, i) => (
            <li key={`${r.latitude},${r.longitude},${i}`}>
              <button type="button" className="block w-full px-3 py-3 text-left text-sm hover:bg-[var(--fo-surface-hover)]" onClick={() => elegir(r)}>
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!buscando && !error && buscado === texto.trim() && resultados.length === 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">Elegí tu dirección de la lista. Si no aparece, probá escribirla de otra forma.</p>
      ) : null}
    </div>
  );
}
