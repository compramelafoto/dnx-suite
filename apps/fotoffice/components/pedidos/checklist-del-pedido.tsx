"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarTareaAction, aplicarPlantillaAction, marcarTareaAction, quitarTareaAction } from "@/app/actions/pedidos";
import { MAX_TEXTO_TAREA } from "@/lib/pedidos/checklist-plantillas";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

export type TareaVista = {
  id: string;
  titulo: string;
  hecha: boolean;
  /** "Ana · 08/10/2026 14:05" ya formateado en el servidor, o null. */
  detalle: string | null;
};

/**
 * Checklist de la ficha del pedido: tildar y destildar (queda quién y cuándo), agregar y quitar
 * tareas y, si el pedido no tiene ninguna, "Aplicar plantilla". Sin "Gestionar" (o con el pedido
 * cancelado) sólo se lee. Las reglas las vuelve a mirar el servidor.
 */
export function ChecklistDelPedido({
  pedidoId,
  tareas,
  plantillas,
  puedeEditar,
}: {
  pedidoId: string;
  tareas: TareaVista[];
  plantillas: string[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [plantilla, setPlantilla] = useState(plantillas[0] ?? "");

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, luego?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        luego?.();
        router.refresh();
      } else setError(r.error);
    });
  }

  const hechas = tareas.filter((t) => t.hecha).length;
  return (
    <div className="space-y-3">
      {tareas.length > 0 ? (
        <>
          <p className="text-xs text-[var(--fo-muted)]">
            {hechas} de {tareas.length} {tareas.length === 1 ? "tarea hecha" : "tareas hechas"}.
          </p>
          <ul className="space-y-2 text-sm">
            {tareas.map((t) => (
              <li key={t.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={t.hecha}
                  disabled={!puedeEditar || pendiente}
                  aria-label={t.titulo}
                  onChange={(e) => correr(() => marcarTareaAction({ pedidoId, tareaId: t.id, hecha: e.target.checked }))}
                />
                <div className="min-w-0 flex-1">
                  <p className={t.hecha ? "text-[var(--fo-muted)] line-through" : "text-[var(--fo-text)]"}>{t.titulo}</p>
                  {t.detalle ? <p className="text-xs text-[var(--fo-muted)]">{t.detalle}</p> : null}
                </div>
                {puedeEditar ? (
                  <button
                    type="button"
                    className="fo-btn fo-btn-ghost text-xs"
                    disabled={pendiente}
                    onClick={() => correr(() => quitarTareaAction({ pedidoId, tareaId: t.id }))}
                    aria-label={`Quitar la tarea ${t.titulo}`}
                  >
                    Quitar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">El pedido no tiene tareas.</p>
      )}

      {puedeEditar && tareas.length === 0 && plantillas.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="checklist-aplicar">
              Plantilla
            </label>
            <select id="checklist-aplicar" className="fo-input" value={plantilla} onChange={(e) => setPlantilla(e.target.value)} disabled={pendiente}>
              {plantillas.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || !plantilla} onClick={() => correr(() => aplicarPlantillaAction({ pedidoId, plantilla }))}>
            Aplicar plantilla
          </button>
        </div>
      ) : null}

      {puedeEditar ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nueva.trim() === "") return;
            correr(() => agregarTareaAction({ pedidoId, titulo: nueva }), () => setNueva(""));
          }}
        >
          <div className="fo-field-stack min-w-0 flex-1">
            <label className="fo-label" htmlFor="checklist-nueva">
              Agregar una tarea
            </label>
            <input id="checklist-nueva" className="fo-input" value={nueva} maxLength={MAX_TEXTO_TAREA} onChange={(e) => setNueva(e.target.value)} disabled={pendiente} />
          </div>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || nueva.trim() === ""}>
            Agregar
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
