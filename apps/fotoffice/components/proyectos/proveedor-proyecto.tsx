"use client";

import { useState, useTransition } from "react";
import { Send, Truck } from "lucide-react";
import { enviarAlProveedorAction, guardarProveedorDelTrabajoAction } from "@/app/actions/proyectos-proveedor";

type Proveedor = { id: string; name: string; email: string | null };

/**
 * Proveedor y entrega de un trabajo: a qué laboratorio va, su número de pedido, lo que cobra y la
 * fecha prometida al cliente. "Enviar al proveedor" lo marca enviado y, si tiene correo, le manda
 * el pedido.
 */
export function ProveedorProyecto({
  proyectoId,
  inicial,
  proveedores,
  enviadoAt,
  puedeEditar,
}: {
  proyectoId: string;
  inicial: { proveedorId: string | null; proveedorRef: string | null; proveedorCostoArs: string | null; entregaPrometida: string | null };
  proveedores: Proveedor[];
  enviadoAt: string | null;
  puedeEditar: boolean;
}) {
  const [proveedorId, setProveedorId] = useState(inicial.proveedorId ?? "");
  const [ref, setRef] = useState(inicial.proveedorRef ?? "");
  const [costo, setCosto] = useState(inicial.proveedorCostoArs ?? "");
  const [entrega, setEntrega] = useState(inicial.entregaPrometida ?? "");
  const [notas, setNotas] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, start] = useTransition();
  const elegido = proveedores.find((p) => p.id === proveedorId) ?? null;

  function guardar() {
    start(async () => {
      const r = await guardarProveedorDelTrabajoAction(proyectoId, {
        proveedorId,
        proveedorRef: ref,
        proveedorCostoArs: costo,
        entregaPrometida: entrega,
      });
      setMensaje(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.error });
    });
  }

  function enviar() {
    start(async () => {
      const g = await guardarProveedorDelTrabajoAction(proyectoId, { proveedorId, proveedorRef: ref, proveedorCostoArs: costo, entregaPrometida: entrega });
      if (!g.ok) {
        setMensaje({ ok: false, texto: g.error });
        return;
      }
      const r = await enviarAlProveedorAction(proyectoId, proveedorId, notas);
      setMensaje(r.ok ? { ok: r.porCorreo, texto: r.aviso } : { ok: false, texto: r.error });
      if (r.ok) setNotas("");
    });
  }

  return (
    <section aria-labelledby="proveedor-titulo" className="fo-card space-y-3 p-4">
      <h2 id="proveedor-titulo" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        <Truck className="size-4" aria-hidden />
        Proveedor y entrega
      </h2>

      <label className="fo-field-stack text-sm">
        <span className="fo-label">Proveedor</span>
        <select className="fo-input" value={proveedorId} disabled={!puedeEditar} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Sin proveedor (se hace en el estudio)</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.email ? "" : " (sin correo)"}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="fo-field-stack text-sm">
          <span className="fo-label">N° de pedido del proveedor</span>
          <input className="fo-input" value={ref} disabled={!puedeEditar} onChange={(e) => setRef(e.target.value)} placeholder="Ej.: 8384" />
        </label>
        <label className="fo-field-stack text-sm">
          <span className="fo-label">Costo del proveedor</span>
          <input className="fo-input" value={costo} disabled={!puedeEditar} onChange={(e) => setCosto(e.target.value)} placeholder="$" inputMode="decimal" />
        </label>
      </div>
      <label className="fo-field-stack text-sm">
        <span className="fo-label">Entrega prometida al cliente</span>
        <input className="fo-input" type="date" value={entrega} disabled={!puedeEditar} onChange={(e) => setEntrega(e.target.value)} />
      </label>

      {puedeEditar ? (
        <>
          <button type="button" className="fo-btn fo-btn-secondary w-full text-sm" disabled={ocupado} onClick={guardar}>
            Guardar
          </button>
          {proveedorId ? (
            <div className="space-y-2 border-t border-[var(--fo-border)] pt-3">
              <textarea
                className="fo-input text-sm"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Indicaciones para el proveedor (ej.: papel mate, cortar polaroid)"
              />
              <button type="button" className="fo-btn fo-btn-primary w-full gap-2 text-sm" disabled={ocupado} onClick={enviar}>
                <Send className="size-4" aria-hidden />
                {elegido?.email ? `Enviar a ${elegido.name} por correo` : `Marcar enviado a ${elegido?.name ?? "proveedor"}`}
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {enviadoAt ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Enviado el {new Date(enviadoAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" })}.
        </p>
      ) : null}
      {mensaje ? (
        <p className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-warning)]"}`} role="status">
          {mensaje.texto}
        </p>
      ) : null}
    </section>
  );
}
