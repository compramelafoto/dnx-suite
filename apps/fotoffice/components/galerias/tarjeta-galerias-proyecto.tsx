"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearGaleriaAction } from "@/app/actions/galerias";
import { ETIQUETA_ESTADO_GALERIA, type EstadoGaleria } from "@/lib/galerias/constantes";
import { claseDeEstadoGaleria } from "@/lib/galerias/estado-vista";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type GaleriaDeTarjetaVista = { id: string; numero: string; nombre: string; estado: EstadoGaleria; fotos: number; enRevision: number };

/**
 * Tarjeta "Galerías" de la ficha del proyecto: las galerías del proyecto con su estado y, con "Gestionar", el
 * botón para crear una nueva (nace en borrador con los valores por omisión y se abre para subir las fotos).
 */
export function TarjetaGaleriasProyecto({
  proyectoId, galerias, puedeCrear,
}: {
  proyectoId: string;
  galerias: GaleriaDeTarjetaVista[];
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function crear() {
    setError(null);
    iniciar(async () => {
      const r = await crearGaleriaAction({ proyectoId }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      router.push(`/galerias/${encodeURIComponent(r.id)}`);
    });
  }

  return (
    <section aria-labelledby="galerias-proyecto-titulo" className="fo-card space-y-3 p-4">
      <h2 id="galerias-proyecto-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Galerías
      </h2>
      {galerias.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Este proyecto todavía no tiene galerías.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {galerias.map((g) => (
            <li key={g.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/galerias/${encodeURIComponent(g.id)}`} className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]">
                <span className="font-medium text-[var(--fo-text)]">N° {g.numero} · {g.nombre}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${claseDeEstadoGaleria(g.estado)}`}>{ETIQUETA_ESTADO_GALERIA[g.estado]}</span>
                  <span>{g.fotos === 1 ? "1 foto" : `${g.fotos.toLocaleString("es-AR")} fotos`}</span>
                  {g.enRevision > 0 ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800">{g.enRevision === 1 ? "1 esperando revisión" : `${g.enRevision} esperando revisión`}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {puedeCrear ? (
        <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={crear}>
          {pendiente ? "Creando…" : "Nueva galería"}
        </button>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
