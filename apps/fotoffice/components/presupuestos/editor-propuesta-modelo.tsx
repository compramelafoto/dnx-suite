"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { borrarPropuestaModeloAction, guardarPropuestaModeloAction } from "@/app/workspace/configuracion/presupuestos/actions";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { itemDesdeProducto, nuevaClave, pesos, type ProductoParaEditor } from "@/lib/presupuestos/editor";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { BuscadorCatalogo } from "./buscador-catalogo";

/**
 * Editor simplificado de la propuesta modelo de una categoría (Entrega B): el mismo buscador del
 * catálogo que el editor de presupuestos y sólo ítems a precio de lista (sin texto libre ni
 * ¿Cuánto Cobro?). El precio que se ve es el del catálogo de hoy: al enviarla, nombre, descripción
 * y precio se toman del catálogo en ese momento.
 */

function aNumero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function EditorPropuestaModelo(props: {
  categoriaId: string;
  existe: boolean;
  items: ItemPresupuesto[];
  condiciones: string | null;
  enviarSola: boolean;
  plantillaId: string | null;
  catalogo: ProductoParaEditor[];
  plantillas: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const id = useId();
  const delCatalogo = new Map(props.catalogo.map((p) => [p.id, p]));
  // Lo guardado con el nombre y el precio del catálogo de hoy (es lo que va a salir).
  const [items, setItems] = useState<ItemPresupuesto[]>(() =>
    props.items.map((i) => {
      const p = i.productId ? delCatalogo.get(i.productId) : undefined;
      return p ? { ...i, nombre: p.nombre, descripcion: p.descripcion, precioUnitario: p.precio } : i;
    }),
  );
  const [condiciones, setCondiciones] = useState(props.condiciones ?? "");
  const [enviarSola, setEnviarSola] = useState(props.enviarSola);
  const [plantillaId, setPlantillaId] = useState(props.plantillaId ?? "");
  const [seccionNueva, setSeccionNueva] = useState("");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const totales = calcularTotales(items, null);
  const fueraDelCatalogo = items.filter((i) => !i.productId || !delCatalogo.has(i.productId));

  function cambiar(nuevos: ItemPresupuesto[]) {
    setItems(nuevos);
    setMensaje(null);
  }
  const actualizar = (clave: string, parche: Partial<ItemPresupuesto>) => cambiar(items.map((i) => (i.id === clave ? { ...i, ...parche } : i)));
  function mover(clave: string, paso: -1 | 1) {
    const i = items.findIndex((x) => x.id === clave);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= items.length) return;
    const copia = [...items];
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    cambiar(copia);
  }

  function guardar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarPropuestaModeloAction({
        categoriaId: props.categoriaId,
        items: items.map((i) => ({ ...i, modoPrecio: "LISTA", calculo: null })),
        condiciones,
        enviarSola,
        plantillaId: plantillaId || null,
      }).catch(() => ({ ok: false as const, error: "No se pudo guardar. Probá de nuevo." }));
      if (r.ok) {
        setMensaje({ ok: true, texto: "Propuesta guardada." });
        router.refresh();
      } else {
        setMensaje({ ok: false, texto: r.error });
      }
    });
  }

  function borrar() {
    if (!window.confirm("¿Borrar la propuesta modelo de esta categoría?")) return;
    setMensaje(null);
    iniciar(async () => {
      const r = await borrarPropuestaModeloAction(props.categoriaId).catch(() => ({ ok: false as const, error: "No se pudo borrar. Probá de nuevo." }));
      if (r.ok) router.push("/workspace/configuracion/presupuestos/propuestas");
      else setMensaje({ ok: false, texto: r.error });
    });
  }

  return (
    <div className="space-y-6">
      <section aria-label="Agregar productos" className="fo-card space-y-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <BuscadorCatalogo
            id={`${id}-buscar`}
            catalogo={props.catalogo}
            onElegir={(p) => cambiar([...items, itemDesdeProducto(p, nuevaClave(), seccionNueva.trim() || null)])}
          />
          <div className="fo-field-stack">
            <label htmlFor={`${id}-sec`} className="fo-label">
              Sección para lo que agregues
            </label>
            <input id={`${id}-sec`} className="fo-input" value={seccionNueva} onChange={(e) => setSeccionNueva(e.target.value)} placeholder="Ej.: Cobertura, Álbum" />
          </div>
        </div>
        <p className="text-xs text-[var(--fo-muted)]">Sólo productos del catálogo, a precio de lista. El precio que sale es el del catálogo el día del envío.</p>
      </section>

      <section aria-label="Productos de la propuesta" className="fo-card space-y-3 overflow-x-auto">
        {items.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay productos. Buscalos en el catálogo.</p> : null}
        {fueraDelCatalogo.length > 0 ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            Hay productos que ya no están en el catálogo: quitalos antes de guardar.
          </p>
        ) : null}
        {items.length > 0 ? (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--fo-muted)]">
                <th className="py-1 pr-2 font-medium">Producto</th>
                <th className="py-1 pr-2 font-medium">Cant.</th>
                <th className="py-1 pr-2 text-right font-medium">Precio de lista</th>
                <th className="py-1 pr-2 text-right font-medium">Subtotal</th>
                <th className="py-1 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const etiquetaFila = `"${it.nombre}"`;
                return (
                  <tr key={it.id} className="border-t border-[var(--fo-border)] align-top">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-[var(--fo-text)]">{it.nombre}</p>
                      <input
                        aria-label={`Sección de ${etiquetaFila}`}
                        className="fo-input mt-1 text-xs"
                        placeholder="Sección (opcional)"
                        value={it.seccion ?? ""}
                        onChange={(e) => actualizar(it.id, { seccion: e.target.value || null })}
                      />
                      <label className="mt-1 flex items-center gap-1 text-xs text-[var(--fo-muted)]">
                        <input
                          type="checkbox"
                          aria-label={`${etiquetaFila} es opcional (no suma al total)`}
                          checked={it.opcional}
                          onChange={(e) => actualizar(it.id, { opcional: e.target.checked })}
                        />
                        Opcional (no suma al total)
                      </label>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label={`Cantidad de ${etiquetaFila}`}
                        type="number"
                        min={0}
                        className="fo-input w-20 text-right"
                        value={it.cantidad}
                        onChange={(e) => actualizar(it.id, { cantidad: aNumero(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{pesos(it.precioUnitario)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{pesos(totales.renglones[it.id]?.neto ?? 0)}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Subir ${etiquetaFila}`} disabled={i === 0} onClick={() => mover(it.id, -1)}>
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Bajar ${etiquetaFila}`} disabled={i === items.length - 1} onClick={() => mover(it.id, 1)}>
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Quitar ${etiquetaFila}`} onClick={() => cambiar(items.filter((x) => x.id !== it.id))}>
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        {items.length > 0 ? <p className="text-right text-sm font-semibold tabular-nums">Total {pesos(totales.total)}</p> : null}
      </section>

      <section aria-label="Condiciones y envío" className="fo-card space-y-4">
        <div className="fo-field-stack">
          <label htmlFor={`${id}-cond`} className="fo-label">
            Condiciones
          </label>
          <textarea id={`${id}-cond`} className="fo-input min-h-28" maxLength={4000} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
          <p className="text-xs text-[var(--fo-muted)]">Vacío: se usan las condiciones generales de Ajustes.</p>
        </div>
        <div className="fo-field-stack">
          <label htmlFor={`${id}-plantilla`} className="fo-label">
            Plantilla de correo
          </label>
          <select id={`${id}-plantilla`} className="fo-input" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
            <option value="">Sin elegir</option>
            {props.plantillas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={enviarSola} onChange={(e) => setEnviarSola(e.target.checked)} />
          <span>
            Enviar sola al llegar una consulta web
            <span className="block text-xs text-[var(--fo-muted)]">
              Reemplaza a la respuesta automática para las consultas de esta categoría que lleguen por el formulario. Sale sólo si la
              respuesta automática está encendida, con los mismos topes (una vez por dirección cada 24 h).
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente} onClick={guardar}>
          {pendiente ? "Guardando…" : "Guardar propuesta"}
        </button>
        {props.existe ? (
          <button type="button" className="fo-btn fo-btn-secondary" disabled={pendiente} onClick={borrar}>
            Borrar propuesta
          </button>
        ) : null}
        <p aria-live="polite" className={mensaje?.ok === false ? "text-sm text-[var(--fo-danger)]" : "text-sm text-[var(--fo-muted)]"}>
          {mensaje?.texto ?? ""}
        </p>
      </div>
    </div>
  );
}
