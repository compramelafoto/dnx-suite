"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { crearPedidoManualAction } from "@/app/actions/pedidos";
import { BuscadorCatalogo } from "@/components/presupuestos/buscador-catalogo";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { itemDesdeProducto, itemLibre, nuevaClave, type ProductoParaEditor } from "@/lib/presupuestos/editor";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { pesosPedido } from "@/lib/pedidos/pantalla";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
const MAX_CUOTAS = 60;

/**
 * "Nuevo pedido" desde un contacto, sin presupuesto: ítems del catálogo o de texto libre (precio de
 * lista), contado o N cuotas, y la fecha y descripción del evento. El plan sale de la opción (se
 * ajusta después con "Editar plan"). El total y todas las reglas los vuelve a calcular el servidor.
 */
export function NuevoPedido({ clientId, catalogo, plantillas = [] }: { clientId: string; catalogo: ProductoParaEditor[]; plantillas?: string[] }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  const [tipo, setTipo] = useState<"CONTADO" | "CUOTAS">("CONTADO");
  const [cuotas, setCuotas] = useState("3");
  const [fechaEvento, setFechaEvento] = useState("");
  const [evento, setEvento] = useState("");
  // Plantilla de checklist; "" = sin checklist. Por omisión, la primera.
  const [checklist, setChecklist] = useState(plantillas[0] ?? "");
  const [error, setError] = useState<string | null>(null);

  const totales = calcularTotales(items, null);

  function cambiar(id: string, cambio: Partial<ItemPresupuesto>) {
    setItems(items.map((i) => (i.id === id ? { ...i, ...cambio } : i)));
  }

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return setError("Cargá al menos un ítem.");
    const n = Number(cuotas);
    if (tipo === "CUOTAS" && (!Number.isInteger(n) || n < 1 || n > MAX_CUOTAS)) return setError("La cantidad de cuotas tiene que ser un número entero entre 1 y 60.");
    setError(null);
    iniciar(async () => {
      const r = await crearPedidoManualAction({
        clientId,
        items,
        opcion: tipo === "CONTADO" ? { tipo: "CONTADO" } : { tipo: "CUOTAS", cuotas: n },
        fechaEvento: fechaEvento || null,
        eventLabel: evento.trim() || null,
        checklist: checklist === "" ? null : checklist,
      }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) router.push(`/pedidos/${encodeURIComponent(r.pedidoId)}`);
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <section aria-labelledby="nuevo-items" className="fo-card space-y-4">
        <h2 id="nuevo-items" className="text-base font-semibold text-[var(--fo-text)]">
          Ítems
        </h2>
        <BuscadorCatalogo id="nuevo-pedido-buscar" catalogo={catalogo} onElegir={(p) => setItems([...items, itemDesdeProducto(p, nuevaClave())])} />
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--fo-muted)]">
                  <th className="py-1 pr-2 font-medium">Ítem</th>
                  <th className="py-1 pr-2 font-medium">Cant.</th>
                  <th className="py-1 pr-2 font-medium">Precio unit.</th>
                  <th className="py-1 pr-2 text-right font-medium">Neto</th>
                  <th className="py-1 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((i, n) => {
                  const etiqueta = i.nombre || `ítem ${n + 1}`;
                  return (
                    <tr key={i.id} className="border-t border-[var(--fo-border)] align-top">
                      <td className="py-2 pr-2">
                        <input
                          className="fo-input w-full"
                          aria-label={`Nombre del ${etiqueta}`}
                          value={i.nombre}
                          maxLength={200}
                          onChange={(e) => cambiar(i.id, { nombre: e.target.value })}
                          required
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="fo-input w-20 tabular-nums"
                          aria-label={`Cantidad de ${etiqueta}`}
                          value={i.cantidad}
                          onChange={(e) => cambiar(i.id, { cantidad: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="fo-input w-32 tabular-nums"
                          aria-label={`Precio unitario de ${etiqueta}`}
                          value={i.precioUnitario}
                          onChange={(e) => cambiar(i.id, { precioUnitario: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{pesosPedido(totales.renglones[i.id]?.neto ?? 0)}</td>
                      <td className="py-2 text-right">
                        <button type="button" className="fo-btn fo-btn-ghost text-xs" aria-label={`Quitar ${etiqueta}`} onClick={() => setItems(items.filter((x) => x.id !== i.id))}>
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Buscá en el catálogo o agregá un ítem de texto libre.</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setItems([...items, itemLibre(nuevaClave())])}>
            Agregar ítem libre
          </button>
          <p className="text-base font-semibold tabular-nums">Total {pesosPedido(totales.total)}</p>
        </div>
      </section>

      <section aria-labelledby="nuevo-pago" className="fo-card grid gap-4 sm:grid-cols-2">
        <h2 id="nuevo-pago" className="text-base font-semibold text-[var(--fo-text)] sm:col-span-2">
          Pago y evento
        </h2>
        <fieldset className="space-y-2 text-sm">
          <legend className="fo-label">Forma de pago</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="tipo" checked={tipo === "CONTADO"} onChange={() => setTipo("CONTADO")} />
            Contado (una cuota que vence hoy)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="tipo" checked={tipo === "CUOTAS"} onChange={() => setTipo("CUOTAS")} />
            En
            <input
              type="number"
              min={1}
              max={MAX_CUOTAS}
              className="fo-input w-20"
              aria-label="Cantidad de cuotas"
              value={cuotas}
              disabled={tipo !== "CUOTAS"}
              onChange={(e) => setCuotas(e.target.value)}
            />
            cuotas mensuales
          </label>
        </fieldset>
        <div className="space-y-3">
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Fecha del evento (opcional)</span>
            <input type="date" className="fo-input" value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)} />
          </label>
          {plantillas.length > 0 ? (
            <label className="fo-field-stack text-sm">
              <span className="fo-label">Checklist del pedido</span>
              <select className="fo-input" value={checklist} onChange={(e) => setChecklist(e.target.value)}>
                {plantillas.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value="">Sin checklist</option>
              </select>
            </label>
          ) : null}
          <label className="fo-field-stack text-sm">
            <span className="fo-label">Evento (opcional)</span>
            <input className="fo-input" value={evento} maxLength={200} onChange={(e) => setEvento(e.target.value)} placeholder="Ej.: Casamiento en Estancia La Pradera" />
          </label>
        </div>
        <p className="text-xs text-[var(--fo-muted)] sm:col-span-2">
          Las cuotas vencen una por mes desde hoy; si el evento cae antes, se reparten hasta la fecha del evento. Después podés ajustar el plan.
        </p>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
        {pendiente ? "Creando…" : "Crear pedido"}
      </button>
    </form>
  );
}
