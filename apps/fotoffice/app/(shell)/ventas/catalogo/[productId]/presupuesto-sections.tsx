"use client";

import { useMemo, useState, useTransition } from "react";
import type { ComboDetalle } from "@/lib/catalogo/combos";
import type { CostoDetalle, ProveedorOpcion } from "@/lib/catalogo/costos";
import type { RubroIngresoOpcion } from "@/lib/catalogo/perfil";
import { pesosSinDecimales, resumenCombo, textoDias, type PerfilCatalogo } from "@/lib/catalogo/reglas";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import {
  guardarComboAction,
  guardarCostosAction,
  guardarPerfilAction,
  guardarReglasProyectoAction,
  type CatalogoActionResult,
  type CostoFormulario,
  type ReglaProyectoFormulario,
} from "./presupuesto-actions";
import type { OpcionesDeRegla, ReglaDetalle } from "@/lib/proyectos/reglas-catalogo";

/**
 * Las secciones de la ficha del producto para presupuestos (etapa 2): "Para presupuestos",
 * "Combo" y "Costos". La ficha entera exige `sales.catalog`, así que quien llega acá puede ver
 * costos; aun así, las reglas de verdad viven en el servidor (`lib/catalogo/*`).
 */

function Aviso({ resultado }: { resultado: CatalogoActionResult | null }) {
  if (!resultado) return null;
  return resultado.ok ? (
    <p className="text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
  ) : (
    <p className="text-sm text-[var(--fo-danger)]" role="alert">
      {resultado.error}
    </p>
  );
}

/** A texto plano, sin el símbolo: lo que espera `parseArsToMinor`. */
function minorATexto(minor: number): string {
  return formatMinorArs(minor).replace("$", "").trim();
}

export function PresupuestoSections({
  productId,
  priceMinor,
  perfil,
  rubros,
  rubroSugerido,
  combo,
  productosCombo,
  costos,
  proveedores,
  proyectos,
}: {
  productId: string;
  priceMinor: number;
  perfil: PerfilCatalogo;
  rubros: RubroIngresoOpcion[];
  /** Si no hay rubro elegido: el de Caja con el mismo nombre que el rubro en texto viejo. */
  rubroSugerido: string | null;
  combo: ComboDetalle;
  productosCombo: { id: string; name: string; priceMinor: number }[];
  costos: CostoDetalle[];
  proveedores: ProveedorOpcion[];
  /** Reglas "Proyecto que genera"; null con el módulo Proyectos apagado. */
  proyectos: { reglas: ReglaDetalle[]; opciones: OpcionesDeRegla } | null;
}) {
  return (
    <div className="space-y-6">
      <PerfilSection productId={productId} perfil={perfil} rubros={rubros} rubroSugerido={rubroSugerido} />
      <ComboSection
        key={combo.componentes.map((c) => `${c.productId}:${c.quantity}`).join("|")}
        productId={productId}
        priceMinor={priceMinor}
        combo={combo}
        productos={productosCombo}
      />
      <CostosSection
        key={costos.map((c) => c.id).join("|")}
        productId={productId}
        costos={costos}
        proveedores={proveedores}
      />
      {proyectos ? (
        <ProyectosSection
          key={proyectos.reglas.map((r) => r.id).join("|")}
          productId={productId}
          reglas={proyectos.reglas}
          opciones={proyectos.opciones}
        />
      ) : null}
    </div>
  );
}

function PerfilSection({
  productId,
  perfil,
  rubros,
  rubroSugerido,
}: {
  productId: string;
  perfil: PerfilCatalogo;
  rubros: RubroIngresoOpcion[];
  rubroSugerido: string | null;
}) {
  const [resultado, setResultado] = useState<CatalogoActionResult | null>(null);
  const [guardando, startTransition] = useTransition();
  const elegido = perfil.incomeCategoryId ?? rubroSugerido ?? "";
  // Hubo rubro en texto (etapa 2) pero ningún rubro de Caja se llama igual: se avisa para que
  // lo elijan o lo creen en Caja.
  const textoSinPar = !perfil.incomeCategoryId && !rubroSugerido && perfil.incomeLabel ? perfil.incomeLabel : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => setResultado(await guardarPerfilAction(productId, fd)));
      }}
      className="fo-card space-y-4 p-5"
    >
      <h2 className="text-base font-semibold">Para presupuestos</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="inPriceList" defaultChecked={perfil.inPriceList} />
        <input type="hidden" name="inPriceList" value="off" />
        En lista de precios
      </label>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="incomeCategoryId">
          Rubro de ingreso
        </label>
        <select id="incomeCategoryId" name="incomeCategoryId" className="fo-input" defaultValue={elegido}>
          <option value="">Sin rubro</option>
          {rubros.map((r) => (
            <option key={r.id} value={r.id}>
              {r.esHijo ? "\u00a0\u00a0\u00a0" : ""}
              {r.code ? `${r.code} ${r.name}` : r.name}
              {r.isActive ? "" : " (dado de baja)"}
            </option>
          ))}
        </select>
        {rubroSugerido && !perfil.incomeCategoryId ? (
          <p className="fo-helper">
            Sugerido por el rubro que tenía cargado («{perfil.incomeLabel}»). Guardá para confirmarlo.
          </p>
        ) : textoSinPar ? (
          <p className="fo-helper">
            Tenía cargado «{textoSinPar}», que no coincide con ningún rubro de Caja. Elegí uno o crealo en Caja →
            Configuración.
          </p>
        ) : (
          <p className="fo-helper">Es la categoría de Caja donde entra el dinero de este producto cuando se cobra.</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <Aviso resultado={resultado} />
      </div>
    </form>
  );
}

type FilaCombo = { productId: string; quantity: string };

function ComboSection({
  productId,
  priceMinor,
  combo,
  productos,
}: {
  productId: string;
  priceMinor: number;
  combo: ComboDetalle;
  productos: { id: string; name: string; priceMinor: number }[];
}) {
  const [filas, setFilas] = useState<FilaCombo[]>(() =>
    combo.componentes.map((c) => ({ productId: c.productId, quantity: String(c.quantity) })),
  );
  const [resultado, setResultado] = useState<CatalogoActionResult | null>(null);
  const [guardando, startTransition] = useTransition();

  // Los componentes inactivos no se ofrecen para agregar, pero si ya estaban siguen a la vista.
  const opciones = useMemo(() => {
    const mapa = new Map(productos.map((p) => [p.id, p]));
    for (const c of combo.componentes) {
      if (!mapa.has(c.productId)) mapa.set(c.productId, { id: c.productId, name: `${c.name} (inactivo)`, priceMinor: c.priceMinor });
    }
    return mapa;
  }, [productos, combo.componentes]);

  const resumen = resumenCombo(
    priceMinor,
    filas
      .filter((f) => f.productId && opciones.has(f.productId))
      .map((f) => ({ priceMinor: opciones.get(f.productId)!.priceMinor, quantity: Math.max(0, Math.trunc(Number(f.quantity)) || 0) })),
  );

  function cambiar(i: number, cambio: Partial<FilaCombo>) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  }

  function guardar() {
    const componentes = filas
      .filter((f) => f.productId)
      .map((f) => ({ productId: f.productId, quantity: Number(f.quantity) }));
    startTransition(async () => setResultado(await guardarComboAction(productId, componentes)));
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Combo</h2>
        <p className="fo-helper">
          Si este producto es un paquete, cargá lo que incluye. El combo tiene su propio precio; acá se ve cuánto sumarían
          sus partes por separado.
        </p>
      </div>

      {filas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">No es un combo.</p> : null}
      <ul className="space-y-2">
        {filas.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <select
              className="fo-input min-w-0 flex-1"
              aria-label="Producto"
              value={f.productId}
              onChange={(e) => cambiar(i, { productId: e.target.value })}
            >
              <option value="">Elegí un producto…</option>
              {[...opciones.values()].map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {pesosSinDecimales(p.priceMinor)}
                </option>
              ))}
            </select>
            <input
              className="fo-input w-20"
              type="number"
              min={1}
              step={1}
              aria-label="Cantidad"
              value={f.quantity}
              onChange={(e) => cambiar(i, { quantity: e.target.value })}
            />
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setFilas((fs) => [...fs, { productId: "", quantity: "1" }])}>
        Agregar componente
      </button>

      {filas.length > 0 ? (
        <dl className="grid gap-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--fo-muted)]">Suma de los componentes</dt>
            <dd className="font-medium">{pesosSinDecimales(resumen.sumaComponentesMinor)}</dd>
          </div>
          <div>
            <dt className="text-[var(--fo-muted)]">Precio del combo</dt>
            <dd className="font-medium">{pesosSinDecimales(priceMinor)}</dd>
          </div>
          <div>
            <dt className="text-[var(--fo-muted)]">{resumen.ahorroMinor >= 0 ? "Ahorro" : "Cuesta de más"}</dt>
            <dd className="font-medium">
              {pesosSinDecimales(Math.abs(resumen.ahorroMinor))}
              {resumen.ahorroPorcentaje !== null ? ` (${Math.abs(resumen.ahorroPorcentaje)} %)` : ""}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar combo"}
        </button>
        <Aviso resultado={resultado} />
      </div>
    </section>
  );
}

function CostosSection({
  productId,
  costos,
  proveedores,
}: {
  productId: string;
  costos: CostoDetalle[];
  proveedores: ProveedorOpcion[];
}) {
  const [filas, setFilas] = useState<CostoFormulario[]>(() =>
    costos.map((c) => ({
      supplierClientId: c.supplierClientId ?? "",
      concept: c.concept,
      amount: minorATexto(c.amountMinor),
      perUnit: c.perUnit,
      daysFromEvent: String(c.daysFromEvent),
    })),
  );
  const [resultado, setResultado] = useState<CatalogoActionResult | null>(null);
  const [guardando, startTransition] = useTransition();

  // Un proveedor ya elegido que no es de categoría Proveedor se sigue mostrando.
  const opciones = useMemo(() => {
    const mapa = new Map(proveedores.map((p) => [p.id, p.name]));
    for (const c of costos) if (c.supplierClientId && !mapa.has(c.supplierClientId)) mapa.set(c.supplierClientId, c.supplierName ?? "Contacto");
    return [...mapa.entries()];
  }, [proveedores, costos]);

  const fijo = filas.filter((f) => !f.perUnit).reduce((t, f) => t + (parseArsToMinor(f.amount) ?? 0), 0);
  const porUnidad = filas.filter((f) => f.perUnit).reduce((t, f) => t + (parseArsToMinor(f.amount) ?? 0), 0);

  function cambiar(i: number, cambio: Partial<CostoFormulario>) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Costos</h2>
        <p className="fo-helper">
          Lo que cuesta vender este producto: laboratorio, segundo fotógrafo, viáticos. Por ahora sólo se registran; los
          pagos a proveedores llegan más adelante.
        </p>
      </div>

      {filas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Sin costos cargados.</p> : null}
      <ul className="space-y-3">
        {filas.map((f, i) => {
          const dias = Number(f.daysFromEvent);
          return (
            <li key={i} className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
              <div className="flex flex-wrap gap-2">
                <input
                  className="fo-input min-w-0 flex-1"
                  aria-label="Concepto"
                  placeholder="Concepto"
                  maxLength={120}
                  value={f.concept}
                  onChange={(e) => cambiar(i, { concept: e.target.value })}
                />
                <select
                  className="fo-input min-w-0 flex-1"
                  aria-label="Proveedor"
                  value={f.supplierClientId}
                  onChange={(e) => cambiar(i, { supplierClientId: e.target.value })}
                >
                  <option value="">Sin proveedor</option>
                  {opciones.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="fo-input w-36"
                  inputMode="decimal"
                  aria-label="Importe"
                  placeholder="Importe"
                  value={f.amount}
                  onChange={(e) => cambiar(i, { amount: e.target.value })}
                />
                <select
                  className="fo-input w-36"
                  aria-label="Fijo o por unidad"
                  value={f.perUnit ? "unidad" : "fijo"}
                  onChange={(e) => cambiar(i, { perUnit: e.target.value === "unidad" })}
                >
                  <option value="fijo">Fijo</option>
                  <option value="unidad">Por unidad</option>
                </select>
                <input
                  className="fo-input w-24"
                  type="number"
                  step={1}
                  aria-label="Días desde el evento"
                  value={f.daysFromEvent}
                  onChange={(e) => cambiar(i, { daysFromEvent: e.target.value })}
                />
                <span className="text-xs text-[var(--fo-muted)]">
                  {Number.isInteger(dias) ? textoDias(dias) : "días desde el evento (+/-)"}
                </span>
                <button type="button" className="fo-btn fo-btn-ghost ml-auto text-sm" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="fo-btn fo-btn-secondary text-sm"
        onClick={() => setFilas((fs) => [...fs, { supplierClientId: "", concept: "", amount: "", perUnit: false, daysFromEvent: "0" }])}
      >
        Agregar costo
      </button>
      {proveedores.length === 0 ? (
        <p className="fo-helper">Para elegir proveedores, cargá contactos con la categoría Proveedor.</p>
      ) : null}

      {filas.length > 0 ? (
        <p className="text-sm">
          Fijo por presupuesto: <span className="font-medium">{pesosSinDecimales(fijo)}</span> · Por unidad:{" "}
          <span className="font-medium">{pesosSinDecimales(porUnidad)}</span>
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm"
          disabled={guardando}
          onClick={() => startTransition(async () => setResultado(await guardarCostosAction(productId, filas)))}
        >
          {guardando ? "Guardando…" : "Guardar costos"}
        </button>
        <Aviso resultado={resultado} />
      </div>
    </section>
  );
}

function ProyectosSection({
  productId,
  reglas,
  opciones,
}: {
  productId: string;
  reglas: ReglaDetalle[];
  opciones: OpcionesDeRegla;
}) {
  const [filas, setFilas] = useState<ReglaProyectoFormulario[]>(() =>
    reglas.map((r) => ({
      circuitId: r.circuitId,
      ownerUserId: r.ownerUserId === null ? "" : String(r.ownerUserId),
      daysFromEvent: String(r.daysFromEvent),
      nameTemplate: r.nameTemplate ?? "",
    })),
  );
  const [resultado, setResultado] = useState<CatalogoActionResult | null>(null);
  const [guardando, startTransition] = useTransition();

  // Un flujo ya elegido que se dio de baja se sigue mostrando (se saltea al vender).
  const flujos = useMemo(() => {
    const mapa = new Map(opciones.circuitos.map((c) => [c.id, c.name]));
    for (const r of reglas) if (!mapa.has(r.circuitId)) mapa.set(r.circuitId, `${r.circuitName} (archivado)`);
    return [...mapa.entries()];
  }, [opciones, reglas]);

  function cambiar(i: number, cambio: Partial<ReglaProyectoFormulario>) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Proyecto que genera</h2>
        <p className="fo-helper">
          Al confirmar un pedido con este producto se abre un proyecto por cada fila, con el flujo de trabajo elegido. La
          cantidad no multiplica: un álbum por cuatro unidades sigue siendo un proyecto. En el nombre podés usar {"{contacto}"},{" "}
          {"{producto}"}, {"{evento}"} y {"{pedido}"}.
        </p>
      </div>

      {filas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">Este producto no abre proyectos.</p> : null}
      <ul className="space-y-3">
        {filas.map((f, i) => {
          const dias = Number(f.daysFromEvent);
          return (
            <li key={i} className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
              <div className="flex flex-wrap gap-2">
                <select
                  className="fo-input min-w-0 flex-1"
                  aria-label="Flujo de trabajo"
                  value={f.circuitId}
                  onChange={(e) => cambiar(i, { circuitId: e.target.value })}
                >
                  <option value="">Elegí el flujo</option>
                  {flujos.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  className="fo-input min-w-0 flex-1"
                  aria-label="Responsable"
                  value={f.ownerUserId}
                  onChange={(e) => cambiar(i, { ownerUserId: e.target.value })}
                >
                  <option value="">El responsable del pedido</option>
                  {opciones.equipo.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="fo-input min-w-0 flex-1"
                  aria-label="Nombre del proyecto"
                  placeholder="{contacto} · {producto}"
                  maxLength={200}
                  value={f.nameTemplate}
                  onChange={(e) => cambiar(i, { nameTemplate: e.target.value })}
                />
                <input
                  className="fo-input w-24"
                  type="number"
                  step={1}
                  min={-365}
                  max={365}
                  aria-label="Días desde el evento"
                  value={f.daysFromEvent}
                  onChange={(e) => cambiar(i, { daysFromEvent: e.target.value })}
                />
                <span className="text-xs text-[var(--fo-muted)]">
                  {Number.isInteger(dias) ? `entrega ${textoDias(dias)}` : "días desde el evento (+/-)"}
                </span>
                <button type="button" className="fo-btn fo-btn-ghost ml-auto text-sm" onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="fo-btn fo-btn-secondary text-sm"
        onClick={() => setFilas((fs) => [...fs, { circuitId: opciones.circuitos[0]?.id ?? "", ownerUserId: "", daysFromEvent: "0", nameTemplate: "" }])}
      >
        Agregar proyecto
      </button>
      {opciones.circuitos.length === 0 ? (
        <p className="fo-helper">Para elegir un flujo, creá uno de trabajo en Configuración → Circuitos.</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm"
          disabled={guardando}
          onClick={() => startTransition(async () => setResultado(await guardarReglasProyectoAction(productId, filas)))}
        >
          {guardando ? "Guardando…" : "Guardar proyectos"}
        </button>
        <Aviso resultado={resultado} />
      </div>
    </section>
  );
}
