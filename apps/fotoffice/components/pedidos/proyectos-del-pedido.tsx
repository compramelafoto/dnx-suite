"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarProyectoAction } from "@/app/actions/proyectos";
import type { ProyectoDeTarjeta as ProyectoDelPedido } from "@/lib/proyectos/tarjetas";
import { fechaCorta } from "@/lib/pedidos/pantalla";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";

/**
 * Proyectos de la ficha del pedido: la lista de los que ya tiene y, con "Gestionar" en Proyectos y
 * un pedido que no está cancelado, "Agregar proyecto" (flujo de trabajo a elección y nombre). Las
 * reglas las vuelve a mirar el servidor.
 */
export function ProyectosDelPedido({
  pedidoId,
  proyectos,
  flujos,
  equipo,
  puedeAgregar,
}: {
  pedidoId: string;
  proyectos: ProyectoDelPedido[];
  flujos: { id: string; name: string }[];
  equipo: { id: number; nombre: string }[];
  puedeAgregar: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flujo, setFlujo] = useState(flujos[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [responsable, setResponsable] = useState("");

  function agregar() {
    setError(null);
    iniciar(async () => {
      const r = await agregarProyectoAction({
        pedidoId,
        circuitId: flujo,
        nombre: nombre.trim() === "" ? null : nombre,
        ownerUserId: responsable === "" ? null : Number(responsable),
      }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        setAbierto(false);
        setNombre("");
        setResponsable("");
        router.refresh();
      } else setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {proyectos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Este pedido todavía no tiene proyectos.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {proyectos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--fo-border)] p-3">
              <div className="min-w-0">
                <Link href={`/proyectos/${encodeURIComponent(p.id)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
                  {p.nombre}
                </Link>
                <p className="text-xs text-[var(--fo-muted)]">
                  N° {p.numero} · {p.flujo}
                  {p.estado === "SUSPENDIDO" ? " · Suspendido" : p.estado === "CERRADO" ? " · Cerrado" : p.etapa ? ` · ${p.etapa}` : ""}
                </p>
              </div>
              {p.finalDueDate ? <span className="text-xs text-[var(--fo-muted)]">Entrega: {fechaCorta(p.finalDueDate)}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {puedeAgregar ? (
        abierto ? (
          <div className="space-y-3 rounded-lg border border-[var(--fo-border)] p-3">
            <div className="fo-field-stack max-w-sm">
              <label className="fo-label" htmlFor="proyecto-flujo">
                Flujo de trabajo
              </label>
              <select id="proyecto-flujo" className="fo-input" value={flujo} onChange={(e) => setFlujo(e.target.value)} disabled={pendiente}>
                {flujos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="fo-field-stack max-w-sm">
              <label className="fo-label" htmlFor="proyecto-nombre">
                Nombre
              </label>
              <input
                id="proyecto-nombre"
                className="fo-input"
                maxLength={200}
                placeholder="Si lo dejás vacío, lleva el nombre del contacto"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={pendiente}
              />
            </div>
            <div className="fo-field-stack max-w-sm">
              <label className="fo-label" htmlFor="proyecto-responsable">
                Responsable
              </label>
              <select id="proyecto-responsable" className="fo-input" value={responsable} onChange={(e) => setResponsable(e.target.value)} disabled={pendiente}>
                <option value="">El del pedido</option>
                {equipo.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={agregar} disabled={pendiente || flujo === ""}>
                {pendiente ? "Agregando…" : "Agregar proyecto"}
              </button>
              <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setAbierto(false)} disabled={pendiente}>
                Cancelar
              </button>
            </div>
          </div>
        ) : flujos.length === 0 ? (
          <p className="fo-helper">Para agregar un proyecto, creá un flujo de trabajo en Configuración → Circuitos.</p>
        ) : (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAbierto(true)}>
            Agregar proyecto
          </button>
        )
      ) : null}
    </div>
  );
}
