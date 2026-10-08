"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmarPedidoAction, vistaPreviaConfirmacionAction } from "@/app/actions/pedidos";
import { ajustePorFormaDePago, fechaCorta, pesosConSigno, pesosPedido } from "@/lib/pedidos/pantalla";
import { aCentavos, ETIQUETA_AVISO_PLAN, type AvisoPlan } from "@/lib/pedidos/plan-cuotas";
import { claveDeFila, cuotasParaGuardar, EditorCuotas, importeDeFila, textoDeImporte, type FilaCuota } from "./editor-cuotas";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

type Vista = {
  total: number;
  totalPresupuesto: number;
  opcion: string | null;
  fechaEvento: string | null;
  eventLabel: string | null;
  aviso: AvisoPlan | null;
  plantillas: string[];
};

/**
 * "Confirmar pedido" en un presupuesto aceptado (con "Gestionar" en Pedidos): muestra el plan que
 * se va a crear (opción elegida, total, cuotas con importes y vencimientos), deja ajustarlo y
 * confirma. Al confirmar abre la ficha del pedido. Si otra persona ya lo confirmó, muestra el
 * enlace al pedido.
 */
export function ConfirmarPedido({ presupuestoId, hoy }: { presupuestoId: string; hoy: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [vista, setVista] = useState<Vista | null>(null);
  const [filas, setFilas] = useState<FilaCuota[]>([]);
  const [editado, setEditado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yaTiene, setYaTiene] = useState<string | null>(null);
  // Plantilla de checklist a copiar; "" = sin checklist.
  const [checklist, setChecklist] = useState("");

  function abrir() {
    setError(null);
    iniciar(async () => {
      const r = await vistaPreviaConfirmacionAction(presupuestoId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) {
        setError(r.error);
        if ("pedidoId" in r && r.pedidoId) setYaTiene(r.pedidoId);
        return;
      }
      const v = r.vista;
      setVista({
        total: v.total,
        totalPresupuesto: v.totalPresupuesto,
        opcion: v.opcion?.etiqueta ?? null,
        fechaEvento: v.fechaEvento,
        eventLabel: v.eventLabel,
        aviso: v.aviso,
        plantillas: v.plantillasChecklist,
      });
      setChecklist(v.plantillasChecklist[0] ?? "");
      setFilas(v.cuotas.map((c) => ({ clave: claveDeFila(), id: null, dueDate: c.dueDate, importe: textoDeImporte(c.amountArs), suggestedMethod: null, imputado: 0 })));
      setEditado(false);
    });
  }

  function confirmar() {
    if (editado && filas.some((f) => importeDeFila(f) === null)) {
      setError("Revisá los importes: cada cuota tiene que ser mayor que cero, con hasta dos decimales.");
      return;
    }
    setError(null);
    iniciar(async () => {
      const plan = editado ? cuotasParaGuardar(filas).map(({ dueDate, amountArs, suggestedMethod }) => ({ dueDate, amountArs, suggestedMethod })) : null;
      const r = await confirmarPedidoAction({ presupuestoId, plan, checklist: checklist === "" ? null : checklist }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        router.push(`/pedidos/${encodeURIComponent(r.pedidoId)}`);
        return;
      }
      setError(r.error);
      if ("pedidoId" in r && r.pedidoId) setYaTiene(r.pedidoId);
    });
  }

  if (yaTiene) {
    return (
      <p className="fo-card text-sm">
        {error ? `${error}: ` : null}
        <Link href={`/pedidos/${encodeURIComponent(yaTiene)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
          Ver el pedido
        </Link>
      </p>
    );
  }

  if (!vista) {
    return (
      <div className="space-y-2">
        <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={abrir} disabled={pendiente}>
          {pendiente ? "Preparando…" : "Confirmar pedido"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const ajuste = ajustePorFormaDePago(vista.total, vista.totalPresupuesto);
  return (
    <section aria-labelledby="confirmar-titulo" className="fo-card space-y-4">
      <div className="space-y-1">
        <h2 id="confirmar-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Confirmar pedido
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {vista.opcion ? `Opción de pago: ${vista.opcion}. ` : ""}
          Total del pedido: {pesosPedido(vista.total)}.
        </p>
        {ajuste ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Total del presupuesto: {pesosPedido(vista.totalPresupuesto)} · {ajuste.etiqueta}: {pesosConSigno(ajuste.importe)}.
          </p>
        ) : null}
        {vista.fechaEvento || vista.eventLabel ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Evento: {[vista.fechaEvento ? fechaCorta(vista.fechaEvento) : null, vista.eventLabel].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {vista.aviso && !editado ? <p className="text-sm text-[var(--fo-warning)]">{ETIQUETA_AVISO_PLAN[vista.aviso]}</p> : null}
      </div>
      {filas.length === 0 && aCentavos(vista.total) === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">El pedido no tiene importe: no lleva plan de cuotas.</p>
      ) : (
        <EditorCuotas
          filas={filas}
          onCambiar={(f) => {
            setFilas(f);
            setEditado(true);
          }}
          total={vista.total}
          hoy={hoy}
          deshabilitado={pendiente}
        />
      )}
      {vista.plantillas.length > 0 ? (
        <div className="fo-field-stack max-w-sm">
          <label className="fo-label" htmlFor="confirmar-checklist">
            Checklist del pedido
          </label>
          <select id="confirmar-checklist" className="fo-input" value={checklist} onChange={(e) => setChecklist(e.target.value)} disabled={pendiente}>
            {vista.plantillas.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="">Sin checklist</option>
          </select>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={confirmar} disabled={pendiente}>
          {pendiente ? "Confirmando…" : "Confirmar el pedido"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setVista(null)} disabled={pendiente}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
