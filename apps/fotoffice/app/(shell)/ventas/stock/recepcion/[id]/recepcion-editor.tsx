"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { InputMoneda } from "@/components/campos/input-moneda";
import { formatMinorArs, minorToDecimalString, parseArsToMinor } from "@/lib/membership/money";
import { calibrarMargenPct } from "@/lib/precios-proveedor/margen";
import { costoSubio, type LineaBorrador } from "@/lib/stock/recepcion";
import { costoPorUnidadDeStock, unidadesDeStock } from "@/lib/stock/recepcion-pantalla";
import type { LineaDetalle } from "@/lib/stock/recepcion-servidor";
import { Dialogo } from "../../../dialogo";
import {
  agregarProductoAction,
  altaRapidaAction,
  buscarProductosAction,
  confirmarAction,
  descartarAction,
  escanearAction,
  guardarEncabezadoAction,
  guardarLineaAction,
  quitarLineaAction,
  type ProductoBuscado,
} from "../actions";

type RecepcionEditable = {
  id: string;
  numero: number;
  proveedorId: string | null;
  /** "aaaa-mm-dd", ya en hora de Buenos Aires. */
  fecha: string;
  comprobante: string;
  preciosConIva: boolean;
  lineas: LineaDetalle[];
  totalMinor: number;
};

type Aviso = { tipo: "ok" | "error"; texto: string } | null;

type DatosAlta = { codigo: string; nombre?: string; marca?: string | null };

/**
 * El borrador de una recepción. Lo central es el campo del lector: el lector de códigos es un
 * teclado que escribe el código y manda Enter, así que el campo tiene que tener el foco todo el
 * tiempo. Después de cada acción (escanear, agregar, quitar, alta rápida) el foco vuelve ahí.
 *
 * Todo lo que cambia el borrador es una acción del servidor seguida de `router.refresh()`
 * (en este repo `revalidate = 0` solo no refresca la pantalla). Las reglas —qué suma a qué
 * línea, la conversión de bultos, qué se puede confirmar— viven en el servidor; acá sólo se
 * muestran sus resultados.
 */
export function RecepcionEditor({
  recepcion,
  proveedores,
}: {
  recepcion: RecepcionEditable;
  proveedores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [guardando, startTransition] = useTransition();
  const [, startBusqueda] = useTransition();
  const lectorRef = useRef<HTMLInputElement>(null);
  const ultimaBusqueda = useRef("");

  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [alta, setAlta] = useState<DatosAlta | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ProductoBuscado[]>([]);
  /** El texto para el que se trajeron `resultados`. */
  const [resultadosDe, setResultadosDe] = useState("");

  const [encabezado, setEncabezado] = useState({
    proveedorId: recepcion.proveedorId ?? "",
    fecha: recepcion.fecha,
    comprobante: recepcion.comprobante,
    preciosConIva: recepcion.preciosConIva,
  });

  const unidades = unidadesDeStock(recepcion.lineas);

  function foco() {
    // Después del render: si el diálogo se acaba de cerrar, el campo recién vuelve a estar.
    requestAnimationFrame(() => lectorRef.current?.focus());
  }

  /** Corre una acción del servidor, muestra su error (si hay) y refresca. */
  function ejecutar(accion: () => Promise<{ ok: true } | { ok: false; error: string } | void>, alTerminar?: () => void) {
    startTransition(async () => {
      const r = await accion();
      if (r && !r.ok) setAviso({ tipo: "error", texto: r.error });
      router.refresh();
      alTerminar?.();
    });
  }

  function escanear() {
    const texto = codigo.trim();
    if (texto === "") return;
    // Se limpia ya: el lector puede mandar el próximo código antes de que vuelva la respuesta.
    setCodigo("");
    startTransition(async () => {
      const r = await escanearAction(recepcion.id, texto);
      if (r.ok) {
        setAviso({ tipo: "ok", texto: r.resultado === "sumado" ? `Se sumó uno (${texto}).` : `Se agregó a la lista (${texto}).` });
        router.refresh();
      } else if (r.alta) {
        setAviso({ tipo: "error", texto: r.error });
        setAlta(r.alta);
        return;
      } else {
        setAviso({ tipo: "error", texto: r.error });
      }
      foco();
    });
  }

  function guardarEncabezado(cambio: Partial<typeof encabezado>) {
    const nuevo = { ...encabezado, ...cambio };
    setEncabezado(nuevo);
    ejecutar(() => guardarEncabezadoAction(recepcion.id, nuevo));
  }

  function buscar(texto: string) {
    setBusqueda(texto);
    ultimaBusqueda.current = texto;
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    startBusqueda(async () => {
      const r = await buscarProductosAction(texto);
      // Si mientras tanto se siguió escribiendo, esta respuesta ya no es la que corresponde.
      if (ultimaBusqueda.current === texto) {
        setResultados(r);
        setResultadosDe(texto);
      }
    });
  }

  function agregar(p: ProductoBuscado) {
    setBusqueda("");
    setResultados([]);
    ultimaBusqueda.current = "";
    ejecutar(async () => {
      const r = await agregarProductoAction(recepcion.id, p.id);
      if (r.ok) setAviso({ tipo: "ok", texto: `Se agregó ${p.nombre}.` });
      return r;
    }, foco);
  }

  function confirmar() {
    startTransition(async () => {
      const r = await confirmarAction(recepcion.id);
      setConfirmando(false);
      if (!r.ok) {
        setAviso({ tipo: "error", texto: r.error });
        foco();
        return;
      }
      setAviso({ tipo: "ok", texto: "Listo: la mercadería se sumó al stock." });
      router.refresh();
    });
  }

  function descartar() {
    if (!window.confirm("¿Descartás esta recepción? No se suma nada al stock.")) return;
    startTransition(async () => {
      // Si sale bien, la acción lleva al historial; si no, se muestra por qué.
      const r = await descartarAction(recepcion.id);
      if (!r.ok) {
        setAviso({ tipo: "error", texto: r.error });
        router.refresh();
        foco();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
            Recepción {recepcion.numero}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
            Escaneá cada caja o buscá el producto por nombre. Podés cerrar y seguir después: nada se
            suma al stock hasta que confirmes.
          </p>
        </div>
        <Link href="/ventas/stock/recepcion" className="fo-btn fo-btn-ghost shrink-0 text-sm">
          Volver al historial
        </Link>
      </div>

      {/* Encabezado: se guarda solo, campo por campo. */}
      <section className="fo-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="recepcion-proveedor">
            Proveedor
          </label>
          <select
            id="recepcion-proveedor"
            className="fo-input"
            value={encabezado.proveedorId}
            onChange={(e) => guardarEncabezado({ proveedorId: e.target.value })}
          >
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="recepcion-fecha">
            Fecha
          </label>
          <input
            id="recepcion-fecha"
            type="date"
            className="fo-input"
            value={encabezado.fecha}
            onChange={(e) => {
              if (e.target.value === "") return;
              guardarEncabezado({ fecha: e.target.value });
            }}
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="recepcion-comprobante">
            Comprobante
          </label>
          <input
            id="recepcion-comprobante"
            className="fo-input"
            placeholder="Factura o remito"
            value={encabezado.comprobante}
            onChange={(e) => setEncabezado((h) => ({ ...h, comprobante: e.target.value }))}
            onBlur={() => {
              if (encabezado.comprobante !== recepcion.comprobante) guardarEncabezado({});
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={encabezado.preciosConIva}
            onChange={(e) => guardarEncabezado({ preciosConIva: e.target.checked })}
          />
          Los costos incluyen IVA
        </label>
      </section>

      {/* Lector y buscador. */}
      <section className="fo-card grid gap-4 p-4 md:grid-cols-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="recepcion-lector">
            Escaneá o escribí el código
          </label>
          <input
            id="recepcion-lector"
            ref={lectorRef}
            className="fo-input"
            autoFocus
            autoComplete="off"
            placeholder="Código de barras o código interno + Enter"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              escanear();
            }}
          />
        </div>
        <div className="fo-field-stack relative">
          <label className="fo-label" htmlFor="recepcion-buscar">
            ¿No tiene código? Buscalo por nombre
          </label>
          <input
            id="recepcion-buscar"
            className="fo-input"
            autoComplete="off"
            placeholder="Papel, ribbon, portarretrato…"
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                buscar("");
                foco();
                return;
              }
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Sólo si los resultados son de lo que está escrito ahora (no de una búsqueda vieja).
              if (resultadosDe === busqueda && resultados[0]) agregar(resultados[0]);
            }}
          />
          {resultados.length > 0 ? (
            <ul className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] shadow-lg">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--fo-surface-hover)]"
                    onClick={() => agregar(p)}
                  >
                    <span className="font-medium">{p.nombre}</span>
                    <span className="block text-xs text-[var(--fo-muted)]">{p.detalle}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : busqueda.trim().length >= 2 ? (
            <p className="fo-helper">Si no aparece, escaneá el código o escribilo arriba para darlo de alta.</p>
          ) : null}
        </div>
        {aviso ? (
          <p
            role={aviso.tipo === "error" ? "alert" : "status"}
            className={`text-sm md:col-span-2 ${aviso.tipo === "error" ? "text-[var(--fo-danger)]" : "text-[var(--fo-success)]"}`}
          >
            {aviso.texto}
          </p>
        ) : null}
      </section>

      {/* Líneas. */}
      {recepcion.lineas.length === 0 ? (
        <div className="fo-card px-6 py-12 text-center text-sm text-[var(--fo-muted)]">
          Todavía no cargaste nada. Escaneá la primera caja.
        </div>
      ) : (
        <div className="fo-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Cantidad</th>
                <th className="px-3 py-2 font-medium">Costo</th>
                <th className="px-3 py-2 text-right font-medium">Costo anterior (c/u)</th>
                <th className="px-3 py-2 text-right font-medium">Precio y margen</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {recepcion.lineas.map((l) => (
                <FilaLinea
                  key={l.id}
                  linea={l}
                  deshabilitada={confirmando}
                  onGuardar={(cambios, enter) =>
                    ejecutar(() => guardarLineaAction(recepcion.id, l.id, cambios), enter ? foco : undefined)
                  }
                  onQuitar={() => ejecutar(() => quitarLineaAction(recepcion.id, l.id), foco)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-3 py-3 font-semibold" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums">{formatMinorArs(recepcion.totalMinor)}</td>
                <td colSpan={3} className="px-3 py-3 text-right text-xs text-[var(--fo-muted)]">
                  {unidades} {unidades === 1 ? "unidad" : "unidades"} de stock
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={guardando} onClick={descartar}>
          Descartar
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm"
          disabled={guardando || recepcion.lineas.length === 0}
          onClick={() => setConfirmando(true)}
        >
          Confirmar recepción
        </button>
      </div>

      {confirmando ? (
        <Dialogo
          titulo="Confirmar recepción"
          onCerrar={() => {
            setConfirmando(false);
            foco();
          }}
        >
          <div className="space-y-4">
            <p className="text-sm">Se van a sumar {unidades} unidades al stock. ¿Confirmás?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="fo-btn fo-btn-ghost text-sm"
                onClick={() => {
                  setConfirmando(false);
                  foco();
                }}
              >
                Volver
              </button>
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={guardando} onClick={confirmar}>
                {guardando ? "Confirmando…" : "Sí, confirmar"}
              </button>
            </div>
          </div>
        </Dialogo>
      ) : null}

      {alta ? (
        <AltaRapidaDialogo
          datos={alta}
          onCerrar={() => {
            setAlta(null);
            foco();
          }}
          onCreado={(reutilizado) => {
            setAlta(null);
            setAviso({
              tipo: "ok",
              texto: reutilizado ? "Ya existía: se sumó a la recepción." : "Listo: se dio de alta y se sumó a la recepción.",
            });
            router.refresh();
            foco();
          }}
          recepcionId={recepcion.id}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Una línea

type CambiosLinea = Parameters<typeof guardarLineaAction>[2];

/** Con coma decimal, como lo entrega `InputMoneda` y lo lee `parseArsToMinor` ("1500,50"). */
function textoCosto(minor: number | null): string {
  return minor === null ? "" : minorToDecimalString(minor).replace(".", ",");
}

/**
 * Una fila editable. Cada campo se guarda al salir (o con Enter, que además devuelve el foco
 * al lector). Si el servidor cambia un valor —p. ej. un nuevo escaneo sumó uno a la cantidad—,
 * se pisa sólo ese campo, no lo que se esté escribiendo en otro.
 */
function FilaLinea({
  linea,
  deshabilitada,
  onGuardar,
  onQuitar,
}: {
  linea: LineaDetalle;
  deshabilitada: boolean;
  onGuardar: (cambios: CambiosLinea, conEnter: boolean) => void;
  onQuitar: () => void;
}) {
  const [cantidad, setCantidad] = useState(String(linea.cantidad));
  const [enBultos, setEnBultos] = useState(linea.enUnidadDeCompra);
  const [porBulto, setPorBulto] = useState(linea.unidadesPorCompra === null ? "" : String(linea.unidadesPorCompra));
  const [costo, setCosto] = useState(textoCosto(linea.costoUnitarioMinor));
  const [error, setError] = useState<string | null>(null);
  const [previa, setPrevia] = useState(linea);
  const enterRef = useRef(false);

  // Ajustar el estado cuando cambian las props, durante el render (patrón de React).
  if (previa !== linea) {
    if (previa.cantidad !== linea.cantidad) setCantidad(String(linea.cantidad));
    if (previa.enUnidadDeCompra !== linea.enUnidadDeCompra) setEnBultos(linea.enUnidadDeCompra);
    if (previa.unidadesPorCompra !== linea.unidadesPorCompra) {
      setPorBulto(linea.unidadesPorCompra === null ? "" : String(linea.unidadesPorCompra));
    }
    if (previa.costoUnitarioMinor !== linea.costoUnitarioMinor) setCosto(textoCosto(linea.costoUnitarioMinor));
    setPrevia(linea);
  }

  function guardar(cambios: CambiosLinea) {
    const conEnter = enterRef.current;
    enterRef.current = false;
    setError(null);
    onGuardar(cambios, conEnter);
  }

  function salirDeCantidad() {
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n <= 0) {
      setError("La cantidad tiene que ser un número entero mayor que cero.");
      return;
    }
    if (n !== linea.cantidad) guardar({ cantidad: n });
  }

  function salirDePorBulto() {
    const n = Number(porBulto);
    if (porBulto.trim() === "" || !Number.isInteger(n) || n < 1) {
      setError("Decí cuántas unidades trae cada bulto.");
      return;
    }
    if (n !== linea.unidadesPorCompra || !linea.enUnidadDeCompra) {
      guardar({ enUnidadDeCompra: true, unidadesPorCompra: n });
    }
  }

  function salirDeCosto() {
    const minor = costo.trim() === "" ? null : parseArsToMinor(costo);
    if (costo.trim() !== "" && minor === null) {
      setError("El costo no se entiende.");
      return;
    }
    if (minor !== linea.costoUnitarioMinor) guardar({ costoUnitarioMinor: minor });
  }

  function cambiarBultos(marcado: boolean) {
    setEnBultos(marcado);
    if (!marcado) {
      guardar({ enUnidadDeCompra: false });
      return;
    }
    // Sin el número no se puede guardar: se espera a que lo escriba.
    const n = Number(porBulto);
    if (porBulto.trim() !== "" && Number.isInteger(n) && n >= 1) guardar({ enUnidadDeCompra: true, unidadesPorCompra: n });
  }

  const conEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      enterRef.current = true;
      e.currentTarget.blur();
    }
  };

  // Lo que se muestra se calcula con lo que está escrito, no con lo último guardado.
  const efectiva: LineaBorrador = {
    ...linea,
    enUnidadDeCompra: enBultos && Number(porBulto) >= 1,
    unidadesPorCompra: Number(porBulto) >= 1 ? Math.floor(Number(porBulto)) : linea.unidadesPorCompra,
    costoUnitarioMinor: costo.trim() === "" ? null : (parseArsToMinor(costo) ?? linea.costoUnitarioMinor),
  };
  const nuevoPorUnidad = costoPorUnidadDeStock(efectiva);
  const anterior = linea.producto?.costMinor ?? null;
  const subio = costoSubio(anterior, nuevoPorUnidad);
  const esProducto = linea.producto?.kind === "PRODUCTO";
  const precio = linea.producto?.priceMinor ?? 0;
  const margen = esProducto && precio > 0 ? calibrarMargenPct(precio, nuevoPorUnidad ?? anterior) : null;
  const unidad = linea.producto?.unidad ?? "unidades";

  return (
    <tr className={`border-b border-[var(--fo-border)] align-top last:border-0 ${subio ? "bg-[var(--fo-warning-soft)]" : ""}`}>
      <td className="px-3 py-2">
        <p className="font-medium text-[var(--fo-text)]">{linea.producto?.nombre ?? linea.descripcionOriginal}</p>
        {linea.producto ? null : <p className="text-xs text-[var(--fo-danger)]">Sin producto: quitala.</p>}
        {linea.codigoBarras ? <p className="text-xs text-[var(--fo-muted)]">{linea.codigoBarras}</p> : null}
        {error ? <p className="text-xs text-[var(--fo-danger)]">{error}</p> : null}
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          step={1}
          className="fo-input"
          style={{ width: "5.5rem" }}
          aria-label={`Cantidad de ${linea.descripcionOriginal}`}
          value={cantidad}
          disabled={deshabilitada}
          onChange={(e) => setCantidad(e.target.value)}
          onBlur={salirDeCantidad}
          onKeyDown={conEnter}
        />
        <label className="mt-1 flex items-center gap-1 text-xs text-[var(--fo-muted)]">
          <input type="checkbox" checked={enBultos} disabled={deshabilitada} onChange={(e) => cambiarBultos(e.target.checked)} />
          en bultos de
          <input
            type="number"
            min={1}
            step={1}
            className="fo-input h-7 text-xs"
            style={{ width: "4.5rem" }}
            aria-label="Unidades por bulto"
            value={porBulto}
            disabled={deshabilitada || !enBultos}
            onChange={(e) => setPorBulto(e.target.value)}
            onBlur={() => {
              if (enBultos) salirDePorBulto();
            }}
            onKeyDown={conEnter}
          />
          {unidad}
        </label>
        {efectiva.enUnidadDeCompra ? (
          <p className="text-xs text-[var(--fo-muted)]">
            = {Number(cantidad) * (efectiva.unidadesPorCompra ?? 1) || 0} {unidad}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <InputMoneda
          value={costo}
          onChange={setCosto}
          onBlur={salirDeCosto}
          onKeyDown={conEnter}
          disabled={deshabilitada}
          placeholder="Costo"
          aria-label={`Costo de ${linea.descripcionOriginal}`}
          wrapperClassName="w-32"
        />
        <p className="mt-1 text-xs text-[var(--fo-muted)]">
          {efectiva.enUnidadDeCompra ? "por bulto" : "c/u"}
          {efectiva.enUnidadDeCompra && nuevoPorUnidad !== null ? ` (${formatMinorArs(nuevoPorUnidad)} c/u)` : ""}
        </p>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {anterior === null ? (
          <span className="text-[var(--fo-muted)]">—</span>
        ) : (
          <span className={subio ? "font-semibold text-[var(--fo-warning)]" : "text-[var(--fo-muted)]"}>
            {formatMinorArs(anterior)}
          </span>
        )}
        {subio ? <p className="text-xs font-medium text-[var(--fo-warning)]">El costo subió</p> : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {esProducto && linea.producto ? (
          <>
            <p>{formatMinorArs(linea.producto.priceMinor)}</p>
            <p className={`text-xs ${margen !== null && margen < 0 ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>
              {precio <= 0
                ? "Sin precio"
                : margen === null
                  ? "Sin margen (falta el costo)"
                  : `Margen ${margen.toLocaleString("es-AR")} %`}
            </p>
          </>
        ) : (
          <span className="text-[var(--fo-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <button type="button" className="fo-btn fo-btn-ghost h-8 px-2 text-xs" disabled={deshabilitada} onClick={onQuitar}>
          Quitar
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------------------------
// Alta rápida

/**
 * Se escaneó un código que no está en el catálogo: se da de alta acá mismo con lo mínimo
 * (nombre, si es producto o insumo, el precio si es producto; la unidad si es insumo) y se suma
 * a la recepción. Si el código estaba en el catálogo compartido, viene con el nombre precargado.
 */
function AltaRapidaDialogo({
  datos,
  recepcionId,
  onCerrar,
  onCreado,
}: {
  datos: DatosAlta;
  recepcionId: string;
  onCerrar: () => void;
  onCreado: (reutilizado: boolean) => void;
}) {
  const [nombre, setNombre] = useState(datos.nombre ?? "");
  const [kind, setKind] = useState<"PRODUCTO" | "INSUMO">("PRODUCTO");
  const [precio, setPrecio] = useState("");
  const [unidad, setUnidad] = useState("unidades");
  const [unidadCompra, setUnidadCompra] = useState("");
  const [porCompra, setPorCompra] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const precioMinor = precio.trim() === "" ? null : parseArsToMinor(precio);
    if (kind === "PRODUCTO" && precio.trim() !== "" && precioMinor === null) {
      setError("El precio no se entiende.");
      return;
    }
    const n = porCompra.trim() === "" ? null : Number(porCompra);
    if (n !== null && (!Number.isInteger(n) || n < 1)) {
      setError("Las unidades por bulto tienen que ser un número entero, de 1 en adelante.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await altaRapidaAction(recepcionId, {
        codigo: datos.codigo,
        nombre,
        kind,
        precioMinor: kind === "PRODUCTO" ? precioMinor : null,
        unidad: kind === "INSUMO" ? unidad : null,
        unidadCompra: kind === "INSUMO" ? unidadCompra : null,
        unidadesPorCompra: kind === "INSUMO" ? n : null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onCreado(r.reutilizado);
    });
  }

  return (
    <Dialogo titulo="Dar de alta" onCerrar={onCerrar}>
      <form className="space-y-3" onSubmit={enviar}>
        <p className="text-sm text-[var(--fo-muted)]">
          El código <span className="font-medium text-[var(--fo-text)]">{datos.codigo}</span> no está en tu catálogo.
          {datos.nombre ? " Lo encontramos en el catálogo compartido: revisá el nombre." : ""}
        </p>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="alta-nombre">
            Nombre
          </label>
          <input id="alta-nombre" className="fo-input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          {datos.marca ? <p className="fo-helper">Marca: {datos.marca}</p> : null}
        </div>
        <fieldset className="flex gap-4 text-sm">
          <legend className="fo-label mb-1">Qué es</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="alta-kind" checked={kind === "PRODUCTO"} onChange={() => setKind("PRODUCTO")} />
            Producto (se vende)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="alta-kind" checked={kind === "INSUMO"} onChange={() => setKind("INSUMO")} />
            Insumo (se usa)
          </label>
        </fieldset>
        {kind === "PRODUCTO" ? (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="alta-precio">
              Precio de venta
            </label>
            <InputMoneda id="alta-precio" value={precio} onChange={setPrecio} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="alta-unidad">
                Se cuenta en
              </label>
              <input id="alta-unidad" className="fo-input" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="alta-unidad-compra">
                Se compra en (opcional)
              </label>
              <input
                id="alta-unidad-compra"
                className="fo-input"
                placeholder="cajas"
                value={unidadCompra}
                onChange={(e) => setUnidadCompra(e.target.value)}
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="alta-por-compra">
                ¿Cuántas trae?
              </label>
              <input
                id="alta-por-compra"
                type="number"
                min={1}
                step={1}
                className="fo-input"
                value={porCompra}
                onChange={(e) => setPorCompra(e.target.value)}
              />
            </div>
          </div>
        )}
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando}>
            {enviando ? "Guardando…" : "Dar de alta y sumar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
