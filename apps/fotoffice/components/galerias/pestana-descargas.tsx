"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { prepararDescargaGaleriaAction, urlParteDescargaGaleriaAction } from "@/app/actions/galerias";
import type { DescargaDeEstudio } from "@/lib/galerias/descargas";
import { ETIQUETA_ESTADO_DESCARGA } from "@/lib/galerias/descargas-reglas";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

const CLASE_ESTADO: Record<DescargaDeEstudio["estado"], string> = {
  PENDIENTE: "bg-blue-100 text-blue-800",
  ARMANDO: "bg-blue-100 text-blue-800",
  LISTA: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-800",
  VENCIDA: "bg-neutral-200 text-neutral-700",
};

/**
 * Pestaña «Descargas» de una galería de entrega: «Preparar descarga» arma en segundo plano un ZIP con todos los
 * archivos (en partes de hasta 1 GB) y avisa por correo; abajo, los últimos pedidos (del estudio y de los clientes).
 */
export function PestanaDescargas({ galeriaId, descargas, puedeGestionar, archivosListos }: { galeriaId: string; descargas: DescargaDeEstudio[]; puedeGestionar: boolean; archivosListos: number }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const hayActiva = descargas.some((d) => d.estado === "PENDIENTE" || d.estado === "ARMANDO");

  function preparar() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await prepararDescargaGaleriaAction(galeriaId).catch(() => null);
      if (!r) return setError(ERROR_CONEXION);
      if (!r.ok) return setError(r.error);
      setAviso(r.yaEnCurso ? "Ya hay una descarga armándose. Cuando termine te llega un correo." : "Listo: la estamos armando. Cuando termine te llega un correo con el enlace.");
      router.refresh();
    });
  }

  function bajar(d: DescargaDeEstudio, tipo: "ZIP" | "SUELTO", n: number) {
    setError(null);
    iniciar(async () => {
      const r = await urlParteDescargaGaleriaAction(galeriaId, d.id, tipo, n).catch(() => null);
      if (!r) return setError(ERROR_CONEXION);
      if (!r.ok) return setError(r.error);
      const a = document.createElement("a");
      a.href = r.url;
      a.rel = "noreferrer noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  return (
    <section aria-labelledby="descargas-titulo" className="fo-card space-y-4 p-4">
      <div className="space-y-1">
        <h2 id="descargas-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Descarga completa
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Armamos un ZIP con todos los archivos, en partes de hasta 1 GB, sin tocar la calidad. Tarda unos minutos y te avisamos por correo. Las partes quedan disponibles 7 días.
        </p>
      </div>

      {puedeGestionar ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente || hayActiva || archivosListos === 0} onClick={preparar}>
            {pendiente ? "Preparando…" : "Preparar descarga"}
          </button>
          {archivosListos === 0 ? <span className="text-sm text-[var(--fo-muted)]">Todavía no hay archivos listos.</span> : null}
          {hayActiva ? <span className="text-sm text-[var(--fo-muted)]">Ya hay una armándose.</span> : null}
        </div>
      ) : null}

      {aviso ? <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">{aviso}</p> : null}
      {error ? <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {descargas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no se pidió ninguna descarga.</p>
      ) : (
        <ul className="space-y-3">
          {descargas.map((d) => (
            <li key={d.id} className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[d.estado]}`}>{ETIQUETA_ESTADO_DESCARGA[d.estado]}</span>
                <span>{d.quien}</span>
                <span className="text-[var(--fo-muted)]">· {d.creada}</span>
              </div>
              <p className="text-[var(--fo-muted)]">
                {d.archivos.toLocaleString("es-AR")} {d.archivos === 1 ? "archivo" : "archivos"} · {d.tamano}
                {d.estado === "ARMANDO" || d.estado === "PENDIENTE" ? ` · ${d.armadas} de ${d.totalPartes} ${d.totalPartes === 1 ? "parte armada" : "partes armadas"}` : ""}
                {d.vence ? ` · disponible hasta el ${d.vence}` : ""}
              </p>
              {d.error ? <p className="text-red-800">{d.error}</p> : null}
              {d.estado === "LISTA" && d.partes.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {d.partes.map((p) => (
                    <li key={`${p.tipo}-${p.n}`}>
                      <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => bajar(d, p.tipo, p.n)}>
                        {p.tipo === "ZIP" ? `Descargar ${p.etiqueta.toLowerCase()} (${p.tamano})` : `Descargar ${p.etiqueta} (${p.tamano})`}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
