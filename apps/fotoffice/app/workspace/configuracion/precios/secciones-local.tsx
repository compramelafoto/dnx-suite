"use client";

import { useId } from "react";
import {
  computeStudioLocalAccount,
  effectiveCoverageSharePercent,
  fixedCostScope,
  INITIAL_STUDIO_STRUCTURE,
  normalizeStudioStructure,
  parseCuantoCobroAmount,
  parsePercent,
  personScope,
  type CuantoCobroStudioBreakdown,
  type CuantoCobroStudioStructure,
  type StudioLocalAccount,
  type StudioScope,
} from "@repo/cuanto-cobro-core";
import { CampoTexto } from "@/components/presupuestos/panel-cuanto-cobro";
import { filasDeCoberturas, separarLocal } from "@/lib/precios/estudio";
import { pesos } from "@/lib/presupuestos/editor";
import { Aviso, SeccionGastosPersonales, SeccionIngresos, type PropsSeccion } from "./secciones";
import type { PropsSeccionEstudio } from "./secciones-estudio";

/**
 * «Local y coberturas» de Mi estudio (spec 2026-10-28-cuanto-cobro-local-y-coberturas-design.md, §4–5):
 * el interruptor, el paso con la clasificación de gastos y personas, y los dos recuadros del resumen.
 * Lo que pase en el local sólo se informa: nunca cambia el precio de los eventos.
 */

const monto = (v: string | undefined) => parseCuantoCobroAmount(v ?? "") ?? 0;
const horas = (h: number) => `${Math.round(h * 10) / 10} h`.replace(".", ",");
const porcentaje = (n: number) => `${Math.round(n * 10) / 10} %`.replace(".", ",");

function bloque(perfil: PropsSeccion["perfil"]): CuantoCobroStudioStructure {
  return normalizeStudioStructure(perfil.studioStructure) ?? { ...INITIAL_STUDIO_STRUCTURE, enabled: true };
}

const ETIQUETA_PARTE: Record<StudioScope, string> = { local: "Local", coverage: "Coberturas", shared: "Compartido" };

// ── Interruptor ──────────────────────────────────────────────────────────────────────────────────

/**
 * Encender propone la clasificación (`separarLocal`); apagar deja todo guardado y vuelve a la cuenta de
 * siempre (con el retiro y lo que dejan otras líneas).
 */
export function InterruptorSepararLocal({ perfil, cambiar }: PropsSeccion) {
  const s = bloque(perfil);
  const encendido = s.separateLocal === true;
  return (
    <label className="flex items-start gap-3 rounded-xl border border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)] p-4">
      <input
        type="checkbox"
        className="mt-1"
        checked={encendido}
        onChange={(e) => cambiar({ studioStructure: e.target.checked ? separarLocal(s) : { ...s, separateLocal: false } })}
      />
      <span className="space-y-1">
        <span className="block text-[0.9375rem] font-semibold">Separar el local de las coberturas</span>
        <span className="block text-sm text-[var(--fo-muted)]">
          El local paga sus gastos y tu sueldo; las coberturas pagan lo que necesitás para vivir. Lo que pase en el local nunca cambia el precio de tus eventos.
        </span>
      </span>
    </label>
  );
}

// ── Paso · Local y coberturas ────────────────────────────────────────────────────────────────────

function SelectorParte<T extends StudioScope>({ etiqueta, valor, opciones, onCambio }: { etiqueta: string; valor: T; opciones: readonly T[]; onCambio: (v: T) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--fo-border)] py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <label htmlFor={id} className="min-w-0 flex-1 text-sm leading-snug">
        {etiqueta}
      </label>
      <select id={id} className="fo-input sm:w-44 sm:shrink-0" value={valor} onChange={(e) => onCambio(e.target.value as T)}>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {ETIQUETA_PARTE[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

const PARTES_GASTO = ["local", "coverage", "shared"] as const;
const PARTES_PERSONA = ["local", "coverage"] as const;

export function SeccionLocalYCoberturas(props: PropsSeccionEstudio) {
  const { perfil, cambiar } = props;
  const s = bloque(perfil);
  const poner = (parcial: Partial<CuantoCobroStudioStructure>) => cambiar({ studioStructure: { ...s, ...parcial } });
  const categorias = props.categoriasIngreso ?? [];
  const tiempoLocal = Math.min(100, Math.max(0, parsePercent(s.ownerLocalTimePercent ?? "") ?? 0));
  const renglones = s.fixedCostGroups.flatMap((g) => g.items.filter((i) => monto(i.amount) > 0).map((i) => ({ grupo: g, item: i })));
  const equipo = s.people.filter((p) => p.role !== "owner");
  const lineas = s.businessLines.filter((l) => !l.sellsHours);
  const editarRenglon = (grupoId: string, itemId: string, scope: StudioScope) =>
    poner({ fixedCostGroups: s.fixedCostGroups.map((g) => (g.id === grupoId ? { ...g, items: g.items.map((i) => (i.id === itemId ? { ...i, scope } : i)) } : g)) });
  const alternarCategoria = (lineaId: string, categoriaId: string) =>
    poner({
      businessLines: s.businessLines.map((l) => {
        if (l.id !== lineaId) return l;
        const actuales = l.cashCategoryIds ?? [];
        return { ...l, cashCategoryIds: actuales.includes(categoriaId) ? actuales.filter((c) => c !== categoriaId) : [...actuales, categoriaId] };
      }),
    });

  return (
    <div className="space-y-6">
      <InterruptorSepararLocal perfil={perfil} cambiar={cambiar} />
      {s.separateLocal ? (
        <>
          <div className="space-y-3">
            <h3 className="text-[0.9375rem] font-semibold">Tus gastos personales</h3>
            <p className="text-sm text-[var(--fo-muted)]">Lo que necesitás para vivir. Lo pagan las coberturas, descontando lo que te paga el local.</p>
            <SeccionGastosPersonales perfil={perfil} cambiar={cambiar} />
          </div>

          <div className="space-y-3">
            <h3 className="text-[0.9375rem] font-semibold">Otros ingresos</h3>
            <p className="text-sm text-[var(--fo-muted)]">Si vivís también de otra cosa, lo que te deja se descuenta de lo que tienen que pagar las coberturas.</p>
            <SeccionIngresos perfil={perfil} cambiar={cambiar} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              tipo="moneda"
              etiqueta="Lo que te paga el local por mes"
              ayuda="Tu sueldo por el tiempo que atendés el local. Sale de los gastos del local y se descuenta de lo que tienen que pagar las coberturas."
              valor={s.ownerLocalSalaryMonthly ?? ""}
              onCambio={(v) => poner({ ownerLocalSalaryMonthly: v })}
            />
            <CampoTexto
              tipo="text"
              etiqueta="Tu tiempo en el local (%)"
              ayuda="La parte de tu semana que pasás atendiendo el local. Tu parte cobrable no puede pasar de lo que queda."
              valor={s.ownerLocalTimePercent ?? ""}
              onCambio={(v) => poner({ ownerLocalTimePercent: v })}
            />
            <CampoTexto
              tipo="text"
              etiqueta="Gastos compartidos que van a coberturas (%)"
              ayuda={`Software, publicidad y administración sirven a las dos partes. Si lo dejás vacío: ${porcentaje(100 - tiempoLocal)} (el tiempo que no le das al local). Ahora: ${porcentaje(effectiveCoverageSharePercent(s))}.`}
              valor={s.coverageSharePercent ?? ""}
              onCambio={(v) => poner({ coverageSharePercent: v })}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-[0.9375rem] font-semibold">¿De quién es cada gasto?</h3>
            <p className="text-sm text-[var(--fo-muted)]">
              Sólo aparecen los gastos fijos con monto. Los compartidos se reparten con el porcentaje de arriba.
            </p>
            {renglones.length > 0 ? (
              <div className="rounded-xl border border-[var(--fo-border)] px-4">
                {renglones.map(({ grupo, item }) => (
                  <SelectorParte
                    key={item.id}
                    etiqueta={`${item.label || grupo.title || "Gasto"} · ${pesos(monto(item.amount))}`}
                    valor={fixedCostScope(grupo.id, item)}
                    opciones={PARTES_GASTO}
                    onCambio={(v) => editarRenglon(grupo.id, item.id, v)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--fo-muted)]">Todavía no cargaste gastos fijos.</p>
            )}
          </div>

          {equipo.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-[0.9375rem] font-semibold">¿Dónde trabaja cada persona?</h3>
              <p className="text-sm text-[var(--fo-muted)]">
                Quien trabaja en el local no suma horas a las coberturas. Si alguna vez va a un evento, sus horas se cobran a su costo.
              </p>
              <div className="rounded-xl border border-[var(--fo-border)] px-4">
                {equipo.map((p, i) => (
                  <SelectorParte
                    key={p.id}
                    etiqueta={p.name.trim() || `Persona ${i + 1}`}
                    valor={personScope(p)}
                    opciones={PARTES_PERSONA}
                    onCambio={(v) => poner({ people: s.people.map((x) => (x.id === p.id ? { ...x, scope: v } : x)) })}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <h3 className="text-[0.9375rem] font-semibold">Ventas del local en Caja</h3>
            <p className="text-sm text-[var(--fo-muted)]">
              Elegí con qué categorías de ingreso de Caja registrás lo que vende cada línea. Con dos meses completos, el resumen mide solo lo que deja el local (se
              actualiza al guardar).
            </p>
            {lineas.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">No hay líneas que no vendan horas. Agregalas en «Otras líneas y ganancia».</p>
            ) : categorias.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">Caja no tiene categorías de ingreso activas.</p>
            ) : (
              lineas.map((l) => (
                <div key={l.id} className="space-y-2">
                  <p className="fo-label">{l.name.trim() || "Línea sin nombre"}</p>
                  <div className="flex flex-wrap gap-2" aria-label={`Categorías de Caja de ${l.name.trim() || "esta línea"}`}>
                    {categorias.map((c) => {
                      const activa = (l.cashCategoryIds ?? []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={activa}
                          className={"rounded-full border px-3 py-1.5 text-xs " + (activa ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] font-semibold" : "border-[var(--fo-border)]")}
                          onClick={() => alternarCategoria(l.id, c.id)}
                        >
                          {c.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              tipo="text"
              etiqueta="Costo de la mercadería (% de lo que vendés)"
              ayuda="Marcos, papel, tinta, productos: de cada $100 que vendés, cuánto se va en lo que vendiste."
              valor={s.localGoodsCostPercent ?? ""}
              onCambio={(v) => poner({ localGoodsCostPercent: v })}
            />
            <CampoTexto
              tipo="moneda"
              etiqueta="Lo que deja el local por mes (estimado)"
              ayuda="Ventas menos mercadería. Se usa mientras Caja no tenga dos meses completos de ventas."
              valor={s.localMonthlyContributionManual ?? ""}
              onCambio={(v) => poner({ localMonthlyContributionManual: v })}
            />
          </div>
        </>
      ) : (
        <Aviso>Apagado: el precio se calcula con tu retiro, como siempre. Lo que cargaste queda guardado.</Aviso>
      )}
    </div>
  );
}

// ── Resumen · Tus coberturas y El local ──────────────────────────────────────────────────────────

function Fila({ t, v, fuerte = false }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <tr className="border-b border-[var(--fo-border)] last:border-b-0">
      <td className={"py-1.5 " + (fuerte ? "font-semibold" : "")}>{t}</td>
      <td className={"py-1.5 text-right tabular-nums " + (fuerte ? "font-bold" : "")}>{v}</td>
    </tr>
  );
}

const FORMATO_MES = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
function nombreDelMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  if (!anio || !m) return mes;
  return FORMATO_MES.format(new Date(Date.UTC(anio, m - 1, 15)));
}

function Semaforo({ resultado, estimado }: { resultado: number; estimado: boolean }) {
  const sobra = resultado >= 0;
  return (
    <p
      role="status"
      className={
        "rounded-xl border px-4 py-3 text-sm font-semibold " +
        (sobra
          ? "border-[var(--fo-success)] bg-[color-mix(in_srgb,var(--fo-success)_10%,var(--fo-bg-elevated))] text-[var(--fo-success)]"
          : "border-[var(--fo-danger)] bg-[color-mix(in_srgb,var(--fo-danger)_10%,var(--fo-bg-elevated))] text-[var(--fo-danger)]")
      }
    >
      <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current align-middle" />
      {sobra ? `Se pagó solo y sobraron ${pesos(resultado)}` : `Le faltaron ${pesos(Math.abs(resultado))}`}
      {estimado ? <span className="ml-2 rounded-full border border-current px-2 py-0.5 text-xs font-medium">estimado</span> : null}
    </p>
  );
}

function RecuadroLocal({ cuenta }: { cuenta: StudioLocalAccount }) {
  const { costs: c } = cuenta;
  return (
    <section className="fo-card space-y-3 p-4" aria-label="El local">
      <h3 className="text-[0.9375rem] font-semibold">El local</h3>
      <table className="w-full text-sm">
        <tbody>
          <Fila t="Gastos fijos del local" v={pesos(c.fixed)} />
          {c.shared > 0 ? <Fila t="Su parte de los compartidos" v={pesos(c.shared)} /> : null}
          {c.team > 0 ? <Fila t="Equipo del local" v={pesos(c.team)} /> : null}
          <Fila t="Tu sueldo del local" v={pesos(c.ownerSalary)} />
          <Fila t="Gastos del local por mes" v={pesos(c.total)} fuerte />
          <Fila t={cuenta.status === "medido" ? "Lo que deja (promedio)" : "Lo que deja por mes"} v={cuenta.averageLeaves === null ? "—" : pesos(cuenta.averageLeaves)} />
        </tbody>
      </table>
      {cuenta.status === "medido" ? (
        <>
          <Semaforo resultado={cuenta.months[0]!.result} estimado={false} />
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {cuenta.months.map((m) => (
              <li key={m.month} className="flex justify-between gap-3 py-1.5">
                <span className="first-letter:uppercase">
                  {nombreDelMes(m.month)} <span className="text-[var(--fo-muted)]">· dejó {pesos(m.leaves)}</span>
                </span>
                <span className={"font-semibold tabular-nums " + (m.result >= 0 ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]")}>
                  {m.result >= 0 ? "+" : "−"}
                  {pesos(Math.abs(m.result))}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : cuenta.status === "estimado" && cuenta.averageResult !== null ? (
        <Semaforo resultado={cuenta.averageResult} estimado />
      ) : (
        <p role="status" className="rounded-xl border border-[var(--fo-border)] px-4 py-3 text-sm text-[var(--fo-muted)]">
          Todavía no hay datos: elegí las categorías de Caja de tus ventas o cargá un estimado
        </p>
      )}
      <p className="text-xs text-[var(--fo-muted)]">Sólo informa: lo que pase en el local nunca cambia el precio de tus eventos.</p>
    </section>
  );
}

function RecuadroCoberturas({ d }: { d: CuantoCobroStudioBreakdown }) {
  const sep = d.separated!;
  const owner = d.people.find((p) => p.role === "owner");
  return (
    <section className="fo-card space-y-3 p-4" aria-label="Tus coberturas">
      <h3 className="text-[0.9375rem] font-semibold">Tus coberturas</h3>
      <table className="w-full text-sm">
        <tbody>
          {filasDeCoberturas(d).map((f) => (
            <Fila key={f.etiqueta} t={f.etiqueta} v={pesos(f.monto)} />
          ))}
          <Fila t="Lo que tienen que cubrir las horas" v={pesos(d.monthlyNeed)} fuerte />
          <Fila t="Horas que podés vender por mes" v={horas(d.capacityHours)} />
        </tbody>
      </table>
      <p className="text-xs text-[var(--fo-muted)]">
        Lo que necesitás llevarte: tus gastos personales ({pesos(sep.personalNeed)})
        {sep.localSalary > 0 ? `, menos lo que te paga el local (${pesos(sep.localSalary)})` : ""}
        {sep.externalIncome > 0 ? `, menos tus otros ingresos (${pesos(sep.externalIncome)})` : ""}
        {sep.ownerNetNeed === 0 && sep.personalNeed > 0 ? ". Ya están cubiertos: no se suma nada." : "."}
      </p>
      <div role="status" className="flex items-center justify-between gap-4 rounded-xl border border-[var(--fo-border-strong)] bg-[var(--fo-surface-muted)] p-3">
        <span className="font-semibold">Tu hora</span>
        <span className="whitespace-nowrap text-lg font-bold tabular-nums text-[var(--fo-accent)]">{owner?.rate == null ? "—" : pesos(owner.rate)}</span>
      </div>
    </section>
  );
}

/** Los dos recuadros del resumen con el local separado: la cuenta que define el precio y la que sólo informa. */
export function ResumenSeparado({ props, d }: { props: PropsSeccionEstudio; d: CuantoCobroStudioBreakdown }) {
  const cuenta = computeStudioLocalAccount(props.perfil, props.ventasLocal ?? null);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RecuadroCoberturas d={d} />
      {cuenta ? <RecuadroLocal cuenta={cuenta} /> : null}
    </div>
  );
}
