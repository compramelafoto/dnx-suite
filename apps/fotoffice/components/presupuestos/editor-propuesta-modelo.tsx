"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, X } from "lucide-react";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { borrarPropuestaModeloAction, guardarPropuestaModeloAction } from "@/app/workspace/configuracion/presupuestos/actions";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { itemDesdeProducto, nuevaClave, pesos, type ProductoParaEditor } from "@/lib/presupuestos/editor";
import { calcularItemDelPanel, entradaDelPanel, trabajoDesdeMotor, trabajoVacio, type TrabajoPanel } from "@/lib/presupuestos/panel-cuanto-cobro";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { AvisoSinPerfil, CampoTexto, CamposTrabajo } from "./panel-cuanto-cobro";
import { BuscadorCatalogo } from "./buscador-catalogo";

/**
 * Editor simplificado de la propuesta modelo de una categoría: el mismo buscador del catálogo que
 * el editor de presupuestos (ítems a precio de lista) y, además, conceptos calculados con
 * ¿Cuánto Cobro? (sin texto libre). Del concepto calculado se guarda SÓLO el trabajo
 * (`calculo.entrada.presupuesto`), nunca el perfil de precios: el perfil llega a esta pantalla
 * porque quien la ve tiene `configurar`, y se usa sólo para mostrar el precio de hoy. Al enviarla,
 * los ítems de lista toman nombre, descripción y precio del catálogo en ese momento, y los
 * calculados se recalculan con el perfil de ese momento.
 */

function aNumero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const esConcepto = (i: ItemPresupuesto) => i.modoPrecio === "CALCULO";

/** El trabajo guardado de un concepto calculado (sólo `entrada.presupuesto`). */
const presupuestoDe = (i: ItemPresupuesto): unknown => (i.calculo?.entrada as { presupuesto?: unknown } | null | undefined)?.presupuesto;

type Edicion = { id: string | null; trabajo: TrabajoPanel; tipoDeTrabajo: string };

export function EditorPropuestaModelo(props: {
  categoriaId: string;
  existe: boolean;
  items: ItemPresupuesto[];
  condiciones: string | null;
  enviarSola: boolean;
  plantillaId: string | null;
  catalogo: ProductoParaEditor[];
  plantillas: { id: string; nombre: string }[];
  /** El perfil de Configuración → Precios, o null si todavía no lo cargaron. */
  perfilDelWorkspace: CuantoCobroProfileInput | null;
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

  const [edicion, setEdicion] = useState<Edicion | null>(null);

  /** El precio de hoy de un concepto calculado (sólo vista); null si falta el perfil o datos. */
  function precioDeHoy(i: ItemPresupuesto): number | null {
    const guardado = trabajoDesdeMotor(presupuestoDe(i));
    if (!props.perfilDelWorkspace || !guardado) return null;
    const r = calcularItemDelPanel(props.perfilDelWorkspace, guardado.trabajo, guardado.tipoDeTrabajo, { id: i.id, nombre: i.nombre });
    return r.ok ? r.item.precioUnitario : null;
  }
  const preciosDeHoy = new Map(items.filter(esConcepto).map((i) => [i.id, precioDeHoy(i)]));
  const totales = calcularTotales(
    items.map((i) => (esConcepto(i) ? { ...i, precioUnitario: preciosDeHoy.get(i.id) ?? 0 } : i)),
    null,
  );
  const vistaPrevia =
    edicion && props.perfilDelWorkspace
      ? calcularItemDelPanel(props.perfilDelWorkspace, edicion.trabajo, edicion.tipoDeTrabajo, { id: edicion.id ?? "vista-previa", nombre: edicion.trabajo.nombre })
      : null;

  function aceptarConcepto() {
    if (!edicion || !props.perfilDelWorkspace || !vistaPrevia?.ok) return;
    // Se guarda sólo el trabajo: el perfil queda afuera.
    const { presupuesto } = entradaDelPanel(props.perfilDelWorkspace, edicion.trabajo, edicion.tipoDeTrabajo);
    const calculo = { entrada: { presupuesto } } as unknown as ItemPresupuesto["calculo"];
    const nombre = vistaPrevia.item.nombre;
    if (edicion.id) {
      const id = edicion.id;
      cambiar(items.map((i) => (i.id === id ? { ...i, nombre, calculo, precioUnitario: 0 } : i)));
    } else {
      cambiar([
        ...items,
        { ...vistaPrevia.item, id: nuevaClave(), seccion: seccionNueva.trim() || null, productId: null, precioUnitario: 0, modoPrecio: "CALCULO", calculo },
      ]);
    }
    setEdicion(null);
  }
  function editarConcepto(i: ItemPresupuesto) {
    const guardado = trabajoDesdeMotor(presupuestoDe(i));
    setEdicion({ id: i.id, trabajo: guardado?.trabajo ?? trabajoVacio(i.nombre), tipoDeTrabajo: guardado?.tipoDeTrabajo ?? "" });
  }

  const fueraDelCatalogo = items.filter((i) => !esConcepto(i) && (!i.productId || !delCatalogo.has(i.productId)));

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
        items: items.map((i) =>
          esConcepto(i)
            ? // Sólo el trabajo; el servidor repite la cuenta al enviar.
              { ...i, productId: null, precioUnitario: 0, modoPrecio: "CALCULO", calculo: { entrada: { presupuesto: presupuestoDe(i) } } }
            : { ...i, modoPrecio: "LISTA", calculo: null },
        ),
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
        <p className="text-xs text-[var(--fo-muted)]">
          Productos del catálogo a precio de lista (el precio que sale es el del catálogo el día del envío) o conceptos calculados con ¿Cuánto Cobro?
        </p>
        {props.perfilDelWorkspace === null ? (
          <AvisoSinPerfil />
        ) : edicion === null ? (
          <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setEdicion({ id: null, trabajo: trabajoVacio(), tipoDeTrabajo: "" })}>
            Agregar concepto calculado
          </button>
        ) : (
          <div role="group" aria-label="Concepto calculado" className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
            <CampoTexto
              etiqueta="Tipo de trabajo"
              tipo="text"
              valor={edicion.tipoDeTrabajo}
              onCambio={(v) => setEdicion({ ...edicion, tipoDeTrabajo: v })}
              ayuda="Por ejemplo: Boda, 15 años, Corporativo."
            />
            <CamposTrabajo trabajo={edicion.trabajo} onCambio={(t) => setEdicion({ ...edicion, trabajo: t })} />
            <p role="status" className="text-sm font-semibold tabular-nums text-[var(--fo-text)]">
              {vistaPrevia?.ok ? `Precio hoy: ${pesos(vistaPrevia.item.precioUnitario)}` : vistaPrevia ? vistaPrevia.error : ""}
            </p>
            {vistaPrevia && !vistaPrevia.ok && vistaPrevia.faltan.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-[var(--fo-muted)]">
                {vistaPrevia.faltan.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <button type="button" className="fo-btn fo-btn-primary" disabled={!vistaPrevia?.ok} onClick={aceptarConcepto}>
                {edicion.id ? "Guardar cambios" : "Agregar a la propuesta"}
              </button>
              <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setEdicion(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--fo-muted)]">El perfil de precios no se guarda en la propuesta: sólo el trabajo. Al enviarla se calcula con tu perfil de ese día.</p>
      </section>

      <section aria-label="Productos de la propuesta" className="fo-card space-y-3 overflow-x-auto">
        {items.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay productos. Buscalos en el catálogo o agregá un concepto calculado.</p> : null}
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
                <th className="py-1 pr-2 text-right font-medium">Precio de lista u hoy</th>
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
                      {esConcepto(it) ? <p className="text-xs text-[var(--fo-muted)]">Calculado con ¿Cuánto Cobro?</p> : null}
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
                      {esConcepto(it) ? (
                        <span className="tabular-nums">{it.cantidad}</span>
                      ) : (
                        <input
                          aria-label={`Cantidad de ${etiquetaFila}`}
                          type="number"
                          min={0}
                          className="fo-input w-20 text-right"
                          value={it.cantidad}
                          onChange={(e) => actualizar(it.id, { cantidad: aNumero(e.target.value) })}
                        />
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {esConcepto(it) ? (preciosDeHoy.get(it.id) != null ? pesos(preciosDeHoy.get(it.id)!) : "—") : pesos(it.precioUnitario)}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{pesos(totales.renglones[it.id]?.neto ?? 0)}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Subir ${etiquetaFila}`} disabled={i === 0} onClick={() => mover(it.id, -1)}>
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Bajar ${etiquetaFila}`} disabled={i === items.length - 1} onClick={() => mover(it.id, 1)}>
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </button>
                        {esConcepto(it) && props.perfilDelWorkspace ? (
                          <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Editar ${etiquetaFila}`} onClick={() => editarConcepto(it)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                        ) : null}
                        <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Quitar ${etiquetaFila}`} onClick={() => { cambiar(items.filter((x) => x.id !== it.id)); if (edicion?.id === it.id) setEdicion(null); }}>
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
