"use client";

import { CalculadoraFotolibro } from "@/components/fotolibro/calculadora-fotolibro";
import type { CatalogoFotolibro } from "@/lib/fotolibro/cotizar";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { guardarBorradorAction } from "@/app/actions/presupuestos";
import { InputMoneda } from "@/components/campos/input-moneda";
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
import {
  agregarAlternativa,
  alternativaPrincipal,
  copiarItemA,
  costosConAlternativas,
  marcarMasElegida,
  MAX_ALTERNATIVAS,
  MAX_DESCRIPCION_ALTERNATIVA,
  MAX_NOMBRE_ALTERNATIVA,
  moverAlternativa,
  moverItemA,
  quitarAlternativa,
  totalesConAlternativas,
  type Alternativa,
} from "@/lib/presupuestos/alternativas";
import { costosDeVersion } from "@/lib/presupuestos/costos";
import { PreguntaleAlBot } from "@/components/dnx-bot/preguntale-al-bot";
import { AsistenteCuantoCobro } from "./asistente-cuanto-cobro";
import { BuscadorCatalogo } from "./buscador-catalogo";
import { PanelCuantoCobro } from "./panel-cuanto-cobro";
import { EditorOpcionesPago } from "./editor-opciones-pago";
import { opcionesVacias } from "@/lib/presupuestos/opciones-pago";

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
 * - Opciones (Básico, Intermedio, Premium…; `lib/presupuestos/alternativas.ts`): de 1 a 4, cada una
 *   con sus ítems y su total. Se agregan, renombran, ordenan y borran; los ítems se mueven o copian
 *   de una a otra. Se edita de a una (la pestaña activa).
 */

const TEXTO_SIN_SECCION = "Sin sección";

function aNumero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Precio unitario con "$" y punto de miles. Guarda lo escrito ("1500.50") mientras coincida con el
 * número del ítem, para que un cero decimal a medio escribir no se pierda; si el precio cambia desde
 * afuera (catálogo, "¿Cuánto Cobro?"), muestra el nuevo.
 */
function CampoPrecio({ precio, onCambio, disabled, "aria-label": etiqueta }: { precio: number; onCambio: (n: number) => void; disabled?: boolean; "aria-label": string }) {
  const [escrito, setEscrito] = useState<string | null>(null);
  const valor = escrito !== null && aNumero(escrito) === precio ? escrito : precio;
  return (
    <InputMoneda
      envio="punto"
      aria-label={etiqueta}
      wrapperClassName="w-32"
      className="fo-input w-full text-right"
      value={valor}
      disabled={disabled}
      onChange={(v) => {
        setEscrito(v);
        onCambio(aNumero(v));
      }}
    />
  );
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

/** Pestañas de las opciones y los datos de la activa (nombre, descripción, «la más elegida»). */
export function PanelAlternativas({
  alternativas,
  activa,
  totales,
  costos,
  deshabilitado,
  onActivar,
  onCambiar,
  onAgregar,
  onQuitar,
}: {
  alternativas: Alternativa[];
  activa: string | null;
  /** Total de cada opción (clave = id). */
  totales: Record<string, number>;
  /** Costo y margen de cada opción, sólo con permiso de costos. */
  costos?: Record<string, { costo?: number; costoTotal?: number; margen: number; margenProporcion: number | null }> | null;
  deshabilitado: boolean;
  onActivar: (id: string) => void;
  onCambiar: (alternativas: Alternativa[]) => void;
  onAgregar: () => void;
  onQuitar: (id: string) => void;
}) {
  const id = useId();
  const a = alternativas.find((x) => x.id === activa) ?? null;
  if (alternativas.length === 0) {
    return (
      <section aria-label="Opciones del presupuesto" className="fo-card flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--fo-muted)]">
          ¿Querés ofrecer varias opciones para que el cliente elija una (por ejemplo Básico, Intermedio y Premium)?
        </p>
        {deshabilitado ? null : (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onAgregar}>
            Ofrecer varias opciones
          </button>
        )}
      </section>
    );
  }
  const editar = (parche: Partial<Alternativa>) => {
    if (a) onCambiar(alternativas.map((x) => (x.id === a.id ? { ...x, ...parche } : x)));
  };
  return (
    <section aria-label="Opciones del presupuesto" className="fo-card space-y-3">
      <div role="tablist" aria-label="Opciones" className="flex flex-wrap gap-2">
        {alternativas.map((x) => {
          const c = costos?.[x.id];
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === activa}
              className={`rounded-[var(--fo-radius-sm)] border px-3 py-2 text-left text-sm ${x.id === activa ? "border-[var(--fo-accent)] font-semibold" : "border-[var(--fo-border)]"}`}
              onClick={() => onActivar(x.id)}
            >
              <span className="block">
                {x.nombre || "Sin nombre"}
                {x.masElegida ? <span className="ml-1 text-xs font-normal text-[var(--fo-muted)]">· la más elegida</span> : null}
              </span>
              <span className="block text-xs font-normal tabular-nums text-[var(--fo-muted)]">
                {pesos(totales[x.id] ?? 0)}
                {c ? ` · margen ${pesos(c.margen)}${c.margenProporcion !== null ? ` (${Math.round(c.margenProporcion * 100)} %)` : ""}` : ""}
              </span>
            </button>
          );
        })}
        {!deshabilitado && alternativas.length < MAX_ALTERNATIVAS ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onAgregar}>
            + Agregar opción
          </button>
        ) : null}
      </div>
      {a ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="fo-field-stack">
            <label htmlFor={`${id}-nombre`} className="fo-label">
              Nombre de la opción
            </label>
            <input
              id={`${id}-nombre`}
              className="fo-input"
              maxLength={MAX_NOMBRE_ALTERNATIVA}
              value={a.nombre}
              disabled={deshabilitado}
              onChange={(e) => editar({ nombre: e.target.value })}
              placeholder="Ej.: Básico"
            />
          </div>
          <div className="fo-field-stack">
            <label htmlFor={`${id}-desc`} className="fo-label">
              Descripción corta (la ve el cliente)
            </label>
            <input
              id={`${id}-desc`}
              className="fo-input"
              maxLength={MAX_DESCRIPCION_ALTERNATIVA}
              value={a.descripcion ?? ""}
              disabled={deshabilitado}
              onChange={(e) => editar({ descripcion: e.target.value || null })}
              placeholder="Ej.: Lo esencial para la fiesta"
            />
          </div>
          {deshabilitado ? null : (
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={a.masElegida} onChange={(e) => onCambiar(marcarMasElegida(alternativas, a.id, e.target.checked))} />
                La más elegida
              </label>
              <button
                type="button"
                className="fo-btn fo-btn-ghost text-sm"
                disabled={alternativas[0]?.id === a.id}
                onClick={() => onCambiar(moverAlternativa(alternativas, a.id, -1))}
              >
                ← Antes
              </button>
              <button
                type="button"
                className="fo-btn fo-btn-ghost text-sm"
                disabled={alternativas.at(-1)?.id === a.id}
                onClick={() => onCambiar(moverAlternativa(alternativas, a.id, 1))}
              >
                Después →
              </button>
              <button
                type="button"
                className="fo-btn fo-btn-ghost text-sm text-[var(--fo-danger)]"
                onClick={() => {
                  const aviso = alternativas.length === 2 ? " Queda un presupuesto común con la otra." : "";
                  if (window.confirm(`¿Borrar la opción «${a.nombre}» con sus ítems?${aviso}`)) onQuitar(a.id);
                }}
              >
                Borrar esta opción
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Presupuestos guardados hace un momento. Después de guardar, la página se refresca y el editor se
 * vuelve a montar con lo que guardó el servidor (la clave es el `updatedAt`); esto sólo sirve para
 * seguir mostrando "Guardado." después de ese remontaje.
 */
const guardadosRecientes = new Map<string, number>();
const RECIENTE_MS = 10_000;

export function EditorPresupuesto({
  datos,
  puedeGuardar,
  botPresupuestoId = null,
  fotolibro = null,
}: {
  datos: DatosEditor;
  puedeGuardar: boolean;
  /** Calculadora de fotolibros (listas de proveedores); null si no hay lista con tapas y hojas. */
  fotolibro?: CatalogoFotolibro | null;
  /** Con DNX Bot encendido (y `configurar`): el presupuesto para «Calcular con el bot». */
  botPresupuestoId?: string | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [items, setItems] = useState<ItemPresupuesto[]>(datos.items);
  const [alternativas, setAlternativas] = useState<Alternativa[]>(datos.alternativas ?? []);
  const [activa, setActiva] = useState<string | null>(() => alternativaPrincipal(datos.alternativas ?? [])?.id ?? null);
  const [descuento, setDescuento] = useState<Descuento | null>(datos.descuento);
  const [condiciones, setCondiciones] = useState(datos.condiciones ?? "");
  const [propuestaPago, setPropuestaPago] = useState(datos.propuestaPago ?? "");
  const [opcionesPago, setOpcionesPago] = useState(() => datos.opcionesPago?.valor ?? opcionesVacias());
  const [seccionNueva, setSeccionNueva] = useState("");
  const [calculando, setCalculando] = useState<string | null>(null);
  /** Ítem recién creado para calcular: si se cierra el panel sin usarlo, se descarta. */
  const [nuevoCalculado, setNuevoCalculado] = useState<string | null>(null);
  const [asistente, setAsistente] = useState(false);
  const [calculadoraFotolibro, setCalculadoraFotolibro] = useState(false);
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

  // Con opciones, se ve y se edita la activa; los totales y el margen son los de esa opción.
  const idActiva = alternativas.some((a) => a.id === activa) ? activa : (alternativas[0]?.id ?? null);
  const nombreActiva = alternativas.find((a) => a.id === idActiva)?.nombre ?? "";
  const visibles = idActiva ? items.filter((i) => i.alternativaId === idActiva) : items;
  const conAlternativas = totalesConAlternativas(items, alternativas, descuento);
  const deActiva = idActiva ? conAlternativas.alternativas.find((a) => a.id === idActiva) : undefined;
  const totales = deActiva ? { ...deActiva.totales, renglones: conAlternativas.totales.renglones } : conAlternativas.totales;
  const catalogoCostos = internos ? new Map(Object.entries(internos.costosCatalogo)) : null;
  const costos = internos && catalogoCostos ? (idActiva ? costosDeVersion(visibles, totales, catalogoCostos) : costosEnVivo(items, totales, internos)) : null;
  const costosPorAlternativa =
    catalogoCostos && alternativas.length > 0
      ? (costosConAlternativas(items, conAlternativas.totales, conAlternativas.alternativas, catalogoCostos).alternativas ?? null)
      : null;
  const seccionActual = seccionNueva.trim() || null;
  const opcionesSeccion = [...new Set<string | null>([null, ...secciones(visibles), seccionActual])];
  /** Lo nuevo va a la opción activa. */
  const enActiva = (it: ItemPresupuesto): ItemPresupuesto => (idActiva ? { ...it, alternativaId: idActiva } : it);

  function cambiar(nuevos: ItemPresupuesto[]) {
    setItems(nuevos);
    setCambios(true);
    setMensaje(null);
  }
  const actualizar = (id: string, parche: Partial<ItemPresupuesto>) => cambiar(items.map((i) => (i.id === id ? { ...i, ...parche } : i)));
  function mover(id: string, paso: -1 | 1) {
    // Con el vecino que se ve (con opciones, el de la misma opción).
    const k = visibles.findIndex((x) => x.id === id);
    const vecino = visibles[k + paso];
    if (k < 0 || !vecino) return;
    const i = items.findIndex((x) => x.id === id);
    const j = items.findIndex((x) => x.id === vecino.id);
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
        alternativas,
        ...(datos.opcionesPago ? { opcionesPago } : {}),
        // No pisar un borrador que cambió mientras el editor estaba abierto (por ejemplo, DNX Bot).
        ...(datos.control ? { control: datos.control } : {}),
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
            <BuscadorCatalogo id={idBusqueda} catalogo={datos.catalogo} onElegir={(p) => cambiar([...items, enActiva(itemDesdeProducto(p, nuevaClave(), seccionActual))])} />
            <div className="fo-field-stack">
              <label htmlFor={`${idBusqueda}-sec`} className="fo-label">
                Sección para lo que agregues
              </label>
              <input id={`${idBusqueda}-sec`} className="fo-input" value={seccionNueva} onChange={(e) => setSeccionNueva(e.target.value)} placeholder="Ej.: Cobertura, Álbum" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => cambiar([...items, enActiva(itemLibre(nuevaClave(), seccionActual))])}>
              Ítem de texto libre
            </button>
            {fotolibro ? (
              <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setCalculadoraFotolibro((v) => !v)}>
                Fotolibro
              </button>
            ) : null}
            {internos ? (
              <>
                <button
                  type="button"
                  className="fo-btn fo-btn-secondary text-sm"
                  onClick={() => {
                    const nuevo = enActiva({ ...itemLibre(nuevaClave(), seccionActual), nombre: "" });
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
                {botPresupuestoId ? (
                  <PreguntaleAlBot
                    etiqueta="Calcular con el bot"
                    mensaje="Quiero sumar ítems calculados a este presupuesto."
                    contexto={{ pantalla: "presupuesto", presupuestoId: botPresupuestoId }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {calculadoraFotolibro && fotolibro ? (
            <CalculadoraFotolibro
              catalogo={fotolibro}
              verCostos={!!internos}
              textoAgregar="Agregar al presupuesto"
              onCerrar={() => setCalculadoraFotolibro(false)}
              onAgregar={(f) => {
                // Ítem de lista con nombre, detalle y precio de la calculadora: el servidor lo guarda tal cual.
                cambiar([
                  ...items,
                  enActiva({ ...itemLibre(nuevaClave(), seccionActual), nombre: "Fotolibro", descripcion: f.libro.descripcion, precioUnitario: f.libro.precioMinor / 100 }),
                  ...(f.caja ? [enActiva({ ...itemLibre(nuevaClave(), seccionActual), nombre: "Caja para fotolibro", descripcion: f.caja.descripcion, precioUnitario: f.caja.precioMinor / 100 })] : []),
                ]);
                setCalculadoraFotolibro(false);
              }}
            />
          ) : null}
          {asistente && internos ? (
            <AsistenteCuantoCobro
              perfilDelWorkspace={datos.internos?.perfil ?? null}
              onCerrar={() => setAsistente(false)}
              onAgregar={(nuevos) => {
                cambiar([...items, ...nuevos.map(enActiva)]);
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

      <PanelAlternativas
        alternativas={alternativas}
        activa={idActiva}
        totales={Object.fromEntries(conAlternativas.alternativas.map((a) => [a.id, a.totales.total]))}
        costos={costosPorAlternativa}
        deshabilitado={!puedeGuardar}
        onActivar={setActiva}
        onCambiar={(xs) => {
          setAlternativas(xs);
          setCambios(true);
          setMensaje(null);
        }}
        onAgregar={() => {
          const r = agregarAlternativa({ alternativas, items });
          setAlternativas(r.alternativas);
          cambiar(r.items);
          if (r.nueva) setActiva(r.nueva);
        }}
        onQuitar={(id) => {
          const r = quitarAlternativa({ alternativas, items }, id);
          setAlternativas(r.alternativas);
          cambiar(r.items);
          setActiva(alternativaPrincipal(r.alternativas)?.id ?? null);
        }}
      />

      <section aria-label="Ítems" className="fo-card space-y-4 overflow-x-auto">
        {idActiva ? <h2 className="text-base font-semibold">Ítems de la opción {nombreActiva}</h2> : null}
        {idActiva && visibles.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Esta opción todavía no tiene ítems. Buscá en el catálogo, agregá uno de texto libre o copiá uno de otra opción.</p>
        ) : null}
        {items.length === 0 && !idActiva ? <p className="text-sm text-[var(--fo-muted)]">Todavía no hay ítems. Buscá en el catálogo o agregá uno de texto libre.</p> : null}
        {visibles.length > 0
          ? secciones(visibles).map((sec) => {
              const deLaSeccion = visibles.filter((i) => i.seccion === sec);
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
                              {puedeGuardar && alternativas.length > 1 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <select
                                    aria-label={`Mover ${etiquetaFila} a otra opción`}
                                    className="fo-input text-xs"
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) cambiar(moverItemA(items, it.id, e.target.value));
                                    }}
                                  >
                                    <option value="">Mover a…</option>
                                    {alternativas
                                      .filter((a) => a.id !== idActiva)
                                      .map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {a.nombre || "Sin nombre"}
                                        </option>
                                      ))}
                                  </select>
                                  {/* Uno calculado, sólo con costos: sin eso su cálculo no llega al navegador y la copia no se podría guardar. */}
                                  {!calculado || internos ? (
                                    <select
                                      aria-label={`Copiar ${etiquetaFila} a otra opción`}
                                      className="fo-input text-xs"
                                      value=""
                                      onChange={(e) => {
                                        if (!e.target.value) return;
                                        const clave = nuevaClave();
                                        cambiar(copiarItemA(items, it.id, e.target.value, clave));
                                        if (ajustados.has(it.id)) marcarAjuste(clave, true);
                                      }}
                                    >
                                      <option value="">Copiar a…</option>
                                      {alternativas
                                        .filter((a) => a.id !== idActiva)
                                        .map((a) => (
                                          <option key={a.id} value={a.id}>
                                            {a.nombre || "Sin nombre"}
                                          </option>
                                        ))}
                                    </select>
                                  ) : null}
                                </div>
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
                              <CampoPrecio
                                aria-label={`Precio unitario de ${etiquetaFila}`}
                                precio={it.precioUnitario}
                                disabled={!puedeGuardar}
                                onCambio={(n) => {
                                  if (calculado) marcarAjuste(it.id, true);
                                  actualizar(it.id, { precioUnitario: n });
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
          <div className="flex justify-between gap-2 border-t border-[var(--fo-border)] pt-2 text-base font-semibold">
            <span>{idActiva ? `Total de ${nombreActiva || "la opción"}` : "Total"}</span>
            <span className="tabular-nums">{pesos(totales.total)}</span>
          </div>
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

      {datos.opcionesPago ? (
        <section aria-label="Opciones de pago" className="fo-card space-y-3">
          <h2 className="text-base font-semibold">Opciones de pago</h2>
          <EditorOpcionesPago
            valor={opcionesPago}
            onCambio={(v) => { setOpcionesPago(v); setCambios(true); }}
            vistaPrevia={{ total: totales.total, fechaEvento: datos.opcionesPago.fechaEvento, hoy: datos.opcionesPago.hoy }}
            deshabilitado={!puedeGuardar}
          />
        </section>
      ) : null}

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
