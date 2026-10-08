"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { guardarBorradorAction } from "@/app/actions/presupuestos";
import type { Descuento, ItemPresupuesto, ModoPrecio, TipoDescuento } from "@/lib/presupuestos/constantes";
import {
  ajustadosIniciales,
  costosEnVivo,
  itemDesdeProducto,
  itemLibre,
  itemsParaGuardar,
  nuevaClave,
  pesos,
  type DatosEditor,
} from "@/lib/presupuestos/editor";
import { calcularTotales } from "@/lib/presupuestos/totales";
import { AsistenteCuantoCobro } from "./asistente-cuanto-cobro";
import { BuscadorCatalogo } from "./buscador-catalogo";
import { PanelCuantoCobro } from "./panel-cuanto-cobro";

/**
 * Editor del borrador de un presupuesto (spec §3.2).
 *
 * - Ítems del catálogo (combos con su ahorro), de texto libre, por secciones y opcionales;
 *   cantidad, precio y descuento por ítem, y descuento global.
 * - Precio de cada ítem: "Lista" o "¿Cuánto Cobro?". El panel y el asistente sólo existen si la
 *   página mandó `internos` (dueño y administradores, R4): sin eso, el editor ni siquiera los
 *   ofrece y un ítem ya calculado se puede pasar a Lista pero no recalcular.
 * - Totales en vivo con la misma cuenta pura que usa el servidor (`calcularTotales`); costo y
 *   margen, sólo con `internos`.
 */

const TEXTO_SIN_SECCION = "Sin sección";

function aNumero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Las secciones en el orden en que aparecen por primera vez. */
function secciones(items: readonly ItemPresupuesto[]): (string | null)[] {
  const out: (string | null)[] = [];
  for (const i of items) if (!out.includes(i.seccion)) out.push(i.seccion);
  return out.length ? out : [null];
}

function DescuentoCampos({ valor, onCambio, etiqueta }: { valor: Descuento | null; onCambio: (d: Descuento | null) => void; etiqueta: string }) {
  const id = useId();
  // El tipo vive acá: pasar a "$" con el valor vacío no tiene que volver a "%".
  const [tipo, setTipo] = useState<TipoDescuento>(valor?.tipo ?? "PORCENTAJE");
  const tope = (t: TipoDescuento, n: number) => (t === "PORCENTAJE" ? Math.min(n, 100) : n);
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={tipo === "PORCENTAJE" ? 100 : undefined}
        className="fo-input w-20 text-right"
        value={valor ? String(valor.valor) : ""}
        placeholder="0"
        onChange={(e) => {
          const n = aNumero(e.target.value);
          onCambio(n > 0 ? { tipo, valor: tope(tipo, n) } : null);
        }}
      />
      <select
        aria-label={`${etiqueta}: tipo`}
        className="fo-input w-14"
        value={tipo}
        onChange={(e) => {
          const t = e.target.value as TipoDescuento;
          setTipo(t);
          // Al pasar a %, un monto mayor que 100 queda en 100.
          if (valor) onCambio({ tipo: t, valor: tope(t, valor.valor) });
        }}
      >
        <option value="PORCENTAJE">%</option>
        <option value="MONTO">$</option>
      </select>
    </div>
  );
}

/**
 * Presupuestos guardados hace un momento. Después de guardar, la página se refresca y el editor se
 * vuelve a montar con lo que guardó el servidor (la clave es el `updatedAt`); esto sólo sirve para
 * seguir mostrando "Guardado." después de ese remontaje.
 */
const guardadosRecientes = new Map<string, number>();
const RECIENTE_MS = 10_000;

export function EditorPresupuesto({ datos, puedeGuardar }: { datos: DatosEditor; puedeGuardar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [items, setItems] = useState<ItemPresupuesto[]>(datos.items);
  const [descuento, setDescuento] = useState<Descuento | null>(datos.descuento);
  const [condiciones, setCondiciones] = useState(datos.condiciones ?? "");
  const [propuestaPago, setPropuestaPago] = useState(datos.propuestaPago ?? "");
  const [seccionNueva, setSeccionNueva] = useState("");
  const [calculando, setCalculando] = useState<string | null>(null);
  /** Ítem recién creado para calcular: si se cierra el panel sin usarlo, se descarta. */
  const [nuevoCalculado, setNuevoCalculado] = useState<string | null>(null);
  const [asistente, setAsistente] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(() =>
    Date.now() - (guardadosRecientes.get(datos.presupuestoId) ?? 0) < RECIENTE_MS ? { ok: true, texto: "Guardado." } : null,
  );
  const [cambios, setCambios] = useState(false);
  /** Ítems calculados con el precio tocado a mano: al guardar viajan con `precioAjustado: true`. */
  const [ajustados, setAjustados] = useState<Set<string>>(() => ajustadosIniciales(datos.items));
  const marcarAjuste = (id: string, ajustado: boolean) =>
    setAjustados((prev) => {
      const s = new Set(prev);
      if (ajustado) s.add(id);
      else s.delete(id);
      return s;
    });
  const internos = datos.internos;
  const idBusqueda = useId();

  const totales = calcularTotales(items, descuento);
  const costos = internos ? costosEnVivo(items, totales, internos) : null;
  const seccionActual = seccionNueva.trim() || null;
  const opcionesSeccion = [...new Set<string | null>([null, ...secciones(items), seccionActual])];

  function cambiar(nuevos: ItemPresupuesto[]) {
    setItems(nuevos);
    setCambios(true);
    setMensaje(null);
  }
  const actualizar = (id: string, parche: Partial<ItemPresupuesto>) => cambiar(items.map((i) => (i.id === id ? { ...i, ...parche } : i)));
  function mover(id: string, paso: -1 | 1) {
    const i = items.findIndex((x) => x.id === id);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= items.length) return;
    const copia = [...items];
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    cambiar(copia);
  }
  function cambiarModo(item: ItemPresupuesto, modo: ModoPrecio) {
    if (modo === item.modoPrecio) return;
    if (modo === "LISTA") {
      const producto = item.productId ? datos.catalogo.find((p) => p.id === item.productId) : undefined;
      actualizar(item.id, { modoPrecio: "LISTA", calculo: null, cantidad: 1, precioUnitario: producto?.precio ?? item.precioUnitario });
      return;
    }
    setCalculando(item.id);
  }
  function renombrarSeccion(de: string | null, a: string) {
    const nombre = a.trim() || null;
    cambiar(items.map((i) => (i.seccion === de ? { ...i, seccion: nombre } : i)));
  }

  function guardar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarBorradorAction({
        presupuestoId: datos.presupuestoId,
        items: itemsParaGuardar(items, !!internos, ajustados),
        descuento,
        condiciones,
        propuestaPago,
      }).catch(() => ({ ok: false as const, error: "No se pudo guardar. Probá de nuevo." }));
      if (r.ok) {
        guardadosRecientes.set(datos.presupuestoId, Date.now());
        setCambios(false);
        setMensaje({ ok: true, texto: "Guardado." });
        router.refresh();
      } else {
        setMensaje({ ok: false, texto: r.error });
      }
    });
  }

  const itemCalculando = calculando ? items.find((i) => i.id === calculando) ?? null : null;

  return (
    <div className="space-y-6">
      {puedeGuardar ? (
        <section aria-label="Agregar ítems" className="fo-card space-y-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <BuscadorCatalogo id={idBusqueda} catalogo={datos.catalogo} onElegir={(p) => cambiar([...items, itemDesdeProducto(p, nuevaClave(), seccionActual)])} />
            <div className="fo-field-stack">
              <label htmlFor={`${idBusqueda}-sec`} className="fo-label">
                Sección para lo que agregues
              </label>
              <input id={`${idBusqueda}-sec`} className="fo-input" value={seccionNueva} onChange={(e) => setSeccionNueva(e.target.value)} placeholder="Ej.: Cobertura, Álbum" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => cambiar([...items, itemLibre(nuevaClave(), seccionActual)])}>
              Ítem de texto libre
            </button>
            {internos ? (
              <>
                <button
                  type="button"
                  className="fo-btn fo-btn-secondary text-sm"
                  onClick={() => {
                    const nuevo = { ...itemLibre(nuevaClave(), seccionActual), nombre: "" };
                    setItems((xs) => [...xs, nuevo]);
                    setNuevoCalculado(nuevo.id);
                    setCalculando(nuevo.id);
                  }}
                >
                  Ítem calculado con ¿Cuánto Cobro?
                </button>
                <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setAsistente(true)}>
                  Armar con ¿Cuánto Cobro?
                </button>
              </>
            ) : null}
          </div>
          {asistente && internos ? (
            <AsistenteCuantoCobro
              perfilDelWorkspace={datos.internos?.perfil ?? null}
              onCerrar={() => setAsistente(false)}
              onAgregar={(nuevos) => {
                cambiar([...items, ...nuevos]);
                setAsistente(false);
              }}
            />
          ) : null}
        </section>
      ) : null}

      {itemCalculando && internos ? (
        <PanelCuantoCobro
          key={itemCalculando.id}
          item={itemCalculando}
          perfilDelWorkspace={datos.internos?.perfil ?? null}
          onCerrar={() => {
            // Un ítem nuevo que nunca se calculó se descarta al cerrar.
            if (nuevoCalculado === itemCalculando.id) setItems((xs) => xs.filter((x) => x.id !== itemCalculando.id));
            setNuevoCalculado(null);
            setCalculando(null);
          }}
          onUsar={(item) => {
            // El precio del panel es el del motor (o su precio a mano): sigue al cálculo.
            marcarAjuste(item.id, false);
            actualizar(item.id, item);
            setNuevoCalculado(null);
            setCalculando(null);
          }}
        />
      ) : null}

      <section aria-label="Ítems" className="fo-card space-y-4 overflow-x-auto">
        {items.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay ítems. Buscá en el catálogo o agregá uno de texto libre.</p> : null}
        {items.length > 0
          ? secciones(items).map((sec) => {
              const deLaSeccion = items.filter((i) => i.seccion === sec);
              const subtotal = totales.secciones.find((s) => s.seccion === sec);
              return (
                <div key={sec ?? "__sin__"} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fo-border)] pb-1">
                    {puedeGuardar && sec !== null ? (
                      <input
                        aria-label="Nombre de la sección"
                        className="fo-input max-w-xs font-semibold"
                        defaultValue={sec}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== sec) renombrarSeccion(sec, e.target.value);
                        }}
                      />
                    ) : (
                      <h3 className="text-sm font-semibold text-[var(--fo-text)]">{sec ?? TEXTO_SIN_SECCION}</h3>
                    )}
                    {subtotal ? <span className="text-sm tabular-nums text-[var(--fo-muted)]">Subtotal {pesos(subtotal.subtotal)}</span> : null}
                  </div>
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[var(--fo-muted)]">
                        <th className="py-1 pr-2 font-medium">Ítem</th>
                        <th className="py-1 pr-2 font-medium">Precio</th>
                        <th className="py-1 pr-2 font-medium">Cant.</th>
                        <th className="py-1 pr-2 font-medium">Precio unit.</th>
                        <th className="py-1 pr-2 font-medium">Descuento</th>
                        <th className="py-1 pr-2 text-right font-medium">Neto</th>
                        {costos ? <th className="py-1 pr-2 text-right font-medium">Costo</th> : null}
                        {costos ? <th className="py-1 pr-2 text-right font-medium">Margen</th> : null}
                        <th className="py-1 font-medium">
                          <span className="sr-only">Acciones</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deLaSeccion.map((it) => {
                        const r = totales.renglones[it.id];
                        const c = costos?.porItem[it.id];
                        const calculado = it.modoPrecio === "CALCULO";
                        const etiquetaFila = it.nombre.trim() ? `"${it.nombre.trim()}"` : "ítem sin nombre";
                        return (
                          <tr key={it.id} className="border-t border-[var(--fo-border)] align-top">
                            <td className="py-2 pr-2">
                              <input
                                aria-label={`Nombre del ítem ${etiquetaFila}`}
                                className="fo-input"
                                value={it.nombre}
                                disabled={!puedeGuardar}
                                onChange={(e) => actualizar(it.id, { nombre: e.target.value })}
                              />
                              <input
                                aria-label={`Descripción de ${etiquetaFila}`}
                                className="fo-input mt-1 text-xs"
                                placeholder="Descripción (opcional)"
                                value={it.descripcion ?? ""}
                                disabled={!puedeGuardar}
                                onChange={(e) => actualizar(it.id, { descripcion: e.target.value || null })}
                              />
                              <label className="mt-1 flex items-center gap-1 text-xs text-[var(--fo-muted)]">
                                <input type="checkbox" aria-label={`${etiquetaFila} es opcional (no suma al total)`} checked={it.opcional} disabled={!puedeGuardar} onChange={(e) => actualizar(it.id, { opcional: e.target.checked })} />
                                Opcional (no suma al total)
                              </label>
                              {puedeGuardar && opcionesSeccion.length > 1 ? (
                                <select
                                  aria-label={`Sección de ${etiquetaFila}`}
                                  className="fo-input mt-1 text-xs"
                                  value={it.seccion ?? ""}
                                  onChange={(e) => actualizar(it.id, { seccion: e.target.value || null })}
                                >
                                  {opcionesSeccion.map((o) => (
                                    <option key={o ?? ""} value={o ?? ""}>
                                      {o ?? TEXTO_SIN_SECCION}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                            </td>
                            <td className="py-2 pr-2">
                              <select
                                aria-label={`Cómo se fija el precio de ${etiquetaFila}`}
                                className="fo-input"
                                value={it.modoPrecio}
                                disabled={!puedeGuardar || (!internos && !calculado)}
                                onChange={(e) => cambiarModo(it, e.target.value as ModoPrecio)}
                              >
                                <option value="LISTA">Lista</option>
                                {internos || calculado ? <option value="CALCULO">¿Cuánto Cobro?</option> : null}
                              </select>
                              {calculado && internos ? (
                                <button type="button" className="mt-1 text-xs text-[var(--fo-accent)] hover:underline" onClick={() => setCalculando(it.id)}>
                                  Ver o recalcular
                                </button>
                              ) : null}
                              {calculado && it.calculo && internos ? (
                                <p className="mt-1 text-xs text-[var(--fo-muted)]">Sugerido {pesos(it.calculo.precioSugerido)}</p>
                              ) : null}
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                aria-label={`Cantidad de ${etiquetaFila}`}
                                type="number"
                                min={0}
                                className="fo-input w-20 text-right"
                                value={it.cantidad}
                                // Un ítem calculado es el precio del trabajo entero: cantidad 1.
                                disabled={!puedeGuardar || calculado}
                                onChange={(e) => actualizar(it.id, { cantidad: aNumero(e.target.value) })}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                aria-label={`Precio unitario de ${etiquetaFila}`}
                                type="number"
                                min={0}
                                className="fo-input w-32 text-right"
                                value={it.precioUnitario}
                                disabled={!puedeGuardar}
                                onChange={(e) => {
                                  if (calculado) marcarAjuste(it.id, true);
                                  actualizar(it.id, { precioUnitario: aNumero(e.target.value) });
                                }}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              {puedeGuardar ? (
                                <DescuentoCampos etiqueta={`Descuento de ${etiquetaFila}`} valor={it.descuento} onCambio={(d) => actualizar(it.id, { descuento: d })} />
                              ) : it.descuento ? (
                                it.descuento.tipo === "PORCENTAJE" ? `${it.descuento.valor} %` : pesos(it.descuento.valor)
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums">
                              {pesos(r?.neto ?? 0)}
                              {it.opcional ? <span className="block text-xs text-[var(--fo-muted)]">opcional</span> : null}
                            </td>
                            {costos ? <td className="py-2 pr-2 text-right tabular-nums">{c?.costo === null || c === undefined ? "—" : pesos(c.costo)}</td> : null}
                            {costos ? <td className="py-2 pr-2 text-right tabular-nums">{c?.margen === null || c === undefined ? "—" : pesos(c.margen)}</td> : null}
                            <td className="py-2">
                              {puedeGuardar ? (
                                <div className="flex gap-1">
                                  <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Subir ${etiquetaFila}`} onClick={() => mover(it.id, -1)}>
                                    <ArrowUp className="size-4" aria-hidden />
                                  </button>
                                  <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Bajar ${etiquetaFila}`} onClick={() => mover(it.id, 1)}>
                                    <ArrowDown className="size-4" aria-hidden />
                                  </button>
                                  <button type="button" className="fo-btn fo-btn-ghost p-1" aria-label={`Quitar ${etiquetaFila}`} onClick={() => cambiar(items.filter((x) => x.id !== it.id))}>
                                    <X className="size-4" aria-hidden />
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })
          : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Condiciones" className="fo-card space-y-3">
          <div className="fo-field-stack">
            <label htmlFor={`${idBusqueda}-cond`} className="fo-label">
              Condiciones
            </label>
            <textarea id={`${idBusqueda}-cond`} className="fo-input min-h-28" maxLength={4000} value={condiciones} disabled={!puedeGuardar} onChange={(e) => { setCondiciones(e.target.value); setCambios(true); }} />
          </div>
          <div className="fo-field-stack">
            <label htmlFor={`${idBusqueda}-pago`} className="fo-label">
              Propuesta de pago
            </label>
            <textarea id={`${idBusqueda}-pago`} className="fo-input min-h-20" maxLength={4000} value={propuestaPago} disabled={!puedeGuardar} onChange={(e) => { setPropuestaPago(e.target.value); setCambios(true); }} />
          </div>
        </section>

        <section aria-label="Totales" className="fo-card space-y-2 text-sm">
          <div className="flex justify-between gap-2"><span className="text-[var(--fo-muted)]">Subtotal</span><span className="tabular-nums">{pesos(totales.subtotal)}</span></div>
          <div className="flex justify-between gap-2"><span className="text-[var(--fo-muted)]">Descuentos de los ítems</span><span className="tabular-nums">−{pesos(totales.descuentoItems)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--fo-muted)]">Descuento global</span>
            {puedeGuardar ? (
              <span className="flex items-center gap-2">
                <DescuentoCampos etiqueta="Descuento global" valor={descuento} onCambio={(d) => { setDescuento(d); setCambios(true); }} />
                <span className="tabular-nums">−{pesos(totales.descuentoGlobal)}</span>
              </span>
            ) : (
              <span className="tabular-nums">−{pesos(totales.descuentoGlobal)}</span>
            )}
          </div>
          <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{pesos(totales.total)}</span></div>
          {totales.opcionales.cantidad > 0 ? (
            <div className="flex justify-between gap-2 text-[var(--fo-muted)]">
              <span>Opcionales ({totales.opcionales.cantidad}, aparte)</span>
              <span className="tabular-nums">{pesos(totales.opcionales.total)}</span>
            </div>
          ) : null}
          {costos ? (
            <div className="space-y-1 border-t border-[var(--fo-border)] pt-2">
              <div className="flex justify-between gap-2"><span className="text-[var(--fo-muted)]">Costo conocido</span><span className="tabular-nums">{pesos(costos.costoTotal)}</span></div>
              <div className="flex justify-between gap-2 font-medium">
                <span>Margen</span>
                <span className="tabular-nums">
                  {pesos(costos.margen)}
                  {costos.margenProporcion !== null ? ` (${Math.round(costos.margenProporcion * 100)} %)` : ""}
                </span>
              </div>
              {costos.itemsSinCosto > 0 ? <p className="text-xs text-[var(--fo-muted)]">{costos.itemsSinCosto} ítem(s) sin costo cargado: el margen real es menor.</p> : null}
            </div>
          ) : null}
        </section>
      </div>

      {puedeGuardar ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="fo-btn fo-btn-primary" disabled={pendiente} onClick={guardar}>
            {pendiente ? "Guardando…" : "Guardar borrador"}
          </button>
          {cambios ? <span className="text-sm text-[var(--fo-muted)]">Hay cambios sin guardar.</span> : null}
          {mensaje ? (
            <span role={mensaje.ok ? "status" : "alert"} className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>
              {mensaje.texto}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
