"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { editarPlanAction } from "@/app/actions/pedidos";
import type { MedioCobro } from "@/lib/pedidos/constantes";
import { claveDeFila, cuotasParaGuardar, EditorCuotas, importeDeFila, textoDeImporte, type FilaCuota } from "./editor-cuotas";

export type CuotaParaEditar = { id: string; dueDate: string; amountArs: number; suggestedMethod: MedioCobro | null; imputado: number };

/**
 * "Editar plan" (con "Gestionar"): cambia importe, vencimiento y medio sugerido de las cuotas,
 * agrega y quita. La suma tiene que dar el total del pedido; una cuota con cobros no se quita ni
 * baja de lo cobrado. Las reglas las vuelve a mirar el servidor.
 */
export function EditarPlan({ pedidoId, cuotas, total, hoy }: { pedidoId: string; cuotas: CuotaParaEditar[]; total: number; hoy: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaCuota[]>([]);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setFilas(
      cuotas.map((c) => ({ clave: claveDeFila(), id: c.id, dueDate: c.dueDate, importe: textoDeImporte(c.amountArs), suggestedMethod: c.suggestedMethod, imputado: c.imputado })),
    );
    setError(null);
    setAbierto(true);
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (filas.some((f) => importeDeFila(f) === null)) {
      setError("Revisá los importes: cada cuota tiene que ser mayor que cero, con hasta dos decimales.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const r = await editarPlanAction({ pedidoId, cuotas: cuotasParaGuardar(filas) }).catch(() => ({
        ok: false as const,
        error: "No se pudo guardar el plan. Probá de nuevo.",
      }));
      if (r.ok) {
        setAbierto(false);
        router.refresh();
      } else setError(r.error);
    });
  }

  if (!abierto) {
    return (
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={abrir}>
        Editar plan
      </button>
    );
  }
  return (
    <form onSubmit={guardar} className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
      <EditorCuotas filas={filas} onCambiar={setFilas} total={total} hoy={hoy} deshabilitado={pendiente} />
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar plan"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setAbierto(false)} disabled={pendiente}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
