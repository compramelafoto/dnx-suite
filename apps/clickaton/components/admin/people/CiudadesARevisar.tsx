"use client";

/**
 * Las ciudades que no se pudieron ubicar solas.
 *
 * DUDOSA: Georef encontró más de una (hay "Rosario" en varias provincias):
 * se elige con un clic. NO_ENCONTRADA: se corrige el nombre y se vuelve a
 * buscar, o se pegan las coordenadas copiadas de Google Maps.
 */
import { useState, useTransition } from "react";

import {
  corregirLocalidadAction,
  elegirCandidataAction,
  ubicarCiudadesPendientesAction,
} from "@/app/admin/(panel)/personas/actions";
import { Button } from "@/components/ui/Button";
import type { LocalidadEnRevision } from "@/lib/people/cargar-personas";

function FilaDeCiudad({ l }: { l: LocalidadEnRevision }) {
  const [ciudad, setCiudad] = useState(l.ciudad);
  const [provincia, setProvincia] = useState(l.provincia ?? "");
  const [coordenadas, setCoordenadas] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const campo =
    "min-h-10 rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-3 py-2 text-sm text-ck-text";

  return (
    <li className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="font-semibold text-ck-text">
          {l.ciudad}
          {l.provincia ? `, ${l.provincia}` : ""}
        </p>
        <span className="text-xs text-ck-text-muted">
          {l.personas} {l.personas === 1 ? "persona" : "personas"} ·{" "}
          {l.estado === "DUDOSA" ? "hay más de una posible" : "no la encontramos"}
        </span>
      </div>

      {l.candidatos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {l.candidatos.map((c, i) => (
            <Button
              key={`${c.ciudad}-${c.provincia}-${i}`}
              type="button"
              size="sm"
              variant="outline"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => setMensaje((await elegirCandidataAction(l.clave, i)).mensaje))
              }
            >
              {c.ciudad}, {c.provincia}
              {c.departamento ? ` (dpto. ${c.departamento})` : ""}
            </Button>
          ))}
        </div>
      ) : null}

      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          iniciar(async () =>
            setMensaje((await corregirLocalidadAction(l.clave, { ciudad, provincia, coordenadas })).mensaje),
          );
        }}
      >
        <input className={campo} value={ciudad} onChange={(e) => setCiudad(e.target.value)} aria-label="Ciudad" />
        <input
          className={campo}
          value={provincia}
          onChange={(e) => setProvincia(e.target.value)}
          placeholder="Provincia"
          aria-label="Provincia"
        />
        <input
          className={campo}
          value={coordenadas}
          onChange={(e) => setCoordenadas(e.target.value)}
          placeholder="Coordenadas (opcional): -32.95, -60.64"
          aria-label="Coordenadas"
        />
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Corregir"}
        </Button>
      </form>
      {mensaje ? <p className="text-sm text-ck-text-secondary">{mensaje}</p> : null}
    </li>
  );
}

export function CiudadesARevisar({
  enRevision,
  pendientesDeUbicar,
}: {
  enRevision: LocalidadEnRevision[];
  pendientesDeUbicar: number;
}) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="space-y-4">
      {pendientesDeUbicar > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4">
          <p className="mr-auto text-sm text-ck-text-secondary">
            Hay {pendientesDeUbicar} {pendientesDeUbicar === 1 ? "ciudad escrita" : "ciudades escritas"} que
            todavía no se buscaron en el mapa.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={pendiente}
            onClick={() => iniciar(async () => setMensaje((await ubicarCiudadesPendientesAction()).mensaje))}
          >
            {pendiente ? "Buscando…" : "Ubicarlas ahora"}
          </Button>
          {mensaje ? <p className="w-full text-sm text-ck-text-secondary">{mensaje}</p> : null}
        </div>
      ) : null}

      {enRevision.length === 0 ? (
        <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-8 text-center text-sm text-ck-text-muted">
          No hay ciudades para revisar: todas están en el mapa.
        </p>
      ) : (
        <ul className="space-y-3">
          {enRevision.map((l) => (
            <FilaDeCiudad key={l.clave} l={l} />
          ))}
        </ul>
      )}
    </div>
  );
}
