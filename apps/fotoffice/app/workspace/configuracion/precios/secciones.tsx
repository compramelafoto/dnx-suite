"use client";

import { useId, useState } from "react";
import {
  COMMERCIAL_POSITIONING_OPTIONS,
  isTimeDistributionValid,
  parseCuantoCobroAmount,
  type CuantoCobroProfileInput,
  type MonthlyExpenseGroup,
  type MonthlyExpenseItem,
  type PhotographyTimeDistribution,
} from "@repo/cuanto-cobro-core";
import {
  createCustomExpenseItemId,
  createDefaultPersonalExpenseGroups,
  PERSONAL_EXPENSE_ITEM_HINTS,
} from "@repo/cuanto-cobro-core/default-expense-groups";
import {
  CC_PERSONAL_EXPENSES_EDUCATION,
  CC_SAVINGS_GOALS_INTRO,
  CC_SAVINGS_GOALS_VS_PERSONAL_VACATIONS,
} from "@repo/cuanto-cobro-core/types";
import { CC_COMMERCIAL_POSITIONING_INTRO, CC_COMMERCIAL_POSITIONING_QUESTION } from "@repo/cuanto-cobro-core/commercial-positioning";
import { InputMoneda } from "@/components/campos/input-moneda";
import { CampoTexto } from "@/components/presupuestos/panel-cuanto-cobro";
import { pesos } from "@/lib/presupuestos/editor";

/** Cada sección recibe el perfil y un `cambiar` que mezcla un parcial. */
export type PropsSeccion = {
  perfil: CuantoCobroProfileInput;
  cambiar: (parcial: Partial<CuantoCobroProfileInput>) => void;
};

const CLAVES_TIEMPO = ["coverage", "editing", "administration", "sales", "marketing", "training"] as const satisfies readonly (keyof PhotographyTimeDistribution)[];

const monto = (v: string) => parseCuantoCobroAmount(v) ?? 0;

/** Cuerpo de un paso: el título y la explicación los pone la tarjeta del asistente. */
function Seccion({ children }: { titulo?: string; ayuda?: string; children: React.ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

/** Recuadro de ayuda, como los del ¿Cuánto Cobro? original. */
export function Aviso({ children, tono = "info" }: { children: React.ReactNode; tono?: "info" | "alerta" }) {
  return (
    <div
      className={
        "rounded-xl border px-4 py-3 text-sm leading-relaxed " +
        (tono === "alerta"
          ? "border-[var(--fo-warning,#d97706)] bg-[color-mix(in_srgb,var(--fo-warning,#d97706)_8%,var(--fo-bg-elevated))]"
          : "border-[var(--fo-border-strong)] bg-[var(--fo-bg-elevated)]")
      }
    >
      {children}
    </div>
  );
}

export function SeccionIngresos({ perfil, cambiar }: PropsSeccion) {
  const id = useId();
  return (
    <Seccion>
      <div className="fo-field-stack">
        <label htmlFor={id} className="fo-label">
          ¿Vivís sólo de la fotografía?
        </label>
        <select
          id={id}
          className="fo-input"
          value={perfil.livesOnlyFromPhotography}
          onChange={(e) => cambiar({ livesOnlyFromPhotography: e.target.value as CuantoCobroProfileInput["livesOnlyFromPhotography"] })}
        >
          <option value="">Elegí una opción</option>
          <option value="yes">Sí, es mi única fuente de ingresos</option>
          <option value="no">No, tengo ingresos externos</option>
        </select>
      </div>
      {perfil.livesOnlyFromPhotography === "no" ? (
        <CampoTexto tipo="moneda" etiqueta="Ingresos externos mensuales" ayuda="El monto neto que recibís por fuera de la fotografía." valor={perfil.externalMonthlyIncome} onCambio={(v) => cambiar({ externalMonthlyIncome: v })} />
      ) : null}
    </Seccion>
  );
}

/** Los grupos de fábrica (Vivienda, Alimentación…) tienen título fijo; los que agrega la persona, no. */
const GRUPOS_DE_FABRICA = new Set(createDefaultPersonalExpenseGroups().map((g) => g.id));

export function SeccionGastosPersonales({ perfil, cambiar }: PropsSeccion) {
  const grupos = perfil.personalExpenseGroups;
  const [abierto, setAbierto] = useState<string | null>(grupos[0]?.id ?? null);
  const poner = (g: MonthlyExpenseGroup[]) => cambiar({ personalExpenseGroups: g });
  const editar = (id: string, f: (g: MonthlyExpenseGroup) => MonthlyExpenseGroup) => poner(grupos.map((g) => (g.id === id ? f(g) : g)));
  const editarRenglon = (grupoId: string, itemId: string, parcial: Partial<MonthlyExpenseItem>) =>
    editar(grupoId, (x) => ({ ...x, items: x.items.map((i) => (i.id === itemId ? { ...i, ...parcial } : i)) }));
  const subtotal = (g: MonthlyExpenseGroup) => g.items.reduce((s, i) => s + monto(i.amount), 0);
  const total = grupos.reduce((s, g) => s + subtotal(g), 0);
  const agregarGrupo = () => {
    const id = `custom-group-${crypto.randomUUID()}`;
    poner([...grupos, { id, title: "", items: [{ id: createCustomExpenseItemId(id), label: "", amount: "", isCustom: true }] }]);
    setAbierto(id);
  };
  return (
    <Seccion>
      <Aviso>{CC_PERSONAL_EXPENSES_EDUCATION}</Aviso>
      <div className="space-y-2.5">
        {grupos.map((g) => {
          const deFabrica = GRUPOS_DE_FABRICA.has(g.id);
          return (
            <details
              key={g.id}
              open={abierto === g.id}
              onToggle={(e) => {
                if (e.currentTarget.open) setAbierto(g.id);
                else if (abierto === g.id) setAbierto(null);
              }}
              className="group overflow-hidden rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="mr-1 h-2 w-2 shrink-0 -rotate-45 border-b-2 border-r-2 border-[var(--fo-accent)] transition-transform group-open:rotate-45"
                />
                <span className="min-w-0 flex-1 text-[0.9375rem]">{g.title || "Grupo nuevo"}</span>
                <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-[var(--fo-accent)]">{pesos(subtotal(g))}</span>
              </summary>
              <div className="border-t border-[var(--fo-border)] px-4 pb-4">
                {deFabrica ? (
                  g.description ? <p className="pt-3 text-[0.8125rem] text-[var(--fo-muted)]">{g.description}</p> : null
                ) : (
                  <div className="fo-field-stack pt-3">
                    <label className="fo-label" htmlFor={`grupo-${g.id}`}>
                      Nombre del grupo
                    </label>
                    <input
                      id={`grupo-${g.id}`}
                      className="fo-input"
                      placeholder="Ej.: Educación de los chicos"
                      value={g.title}
                      onChange={(e) => editar(g.id, (x) => ({ ...x, title: e.target.value }))}
                    />
                  </div>
                )}
                {g.items.map((it) => {
                  const ayuda = it.isCustom ? undefined : PERSONAL_EXPENSE_ITEM_HINTS[it.id];
                  const idMonto = `gasto-${g.id}-${it.id}`;
                  return (
                    <div
                      key={it.id}
                      className="flex flex-col gap-2 border-b border-[var(--fo-border)] py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        {it.isCustom ? (
                          <input
                            className="fo-input"
                            aria-label="Nombre del gasto"
                            placeholder="Nombre del gasto"
                            value={it.label}
                            onChange={(e) => editarRenglon(g.id, it.id, { label: e.target.value })}
                          />
                        ) : (
                          <>
                            <label htmlFor={idMonto} className="block text-sm leading-snug">
                              {it.label}
                            </label>
                            {ayuda ? <p className="mt-1 text-xs leading-snug text-[var(--fo-muted)]">{ayuda}</p> : null}
                          </>
                        )}
                      </div>
                      <div className="flex w-full items-stretch gap-2 sm:w-auto sm:min-w-[12rem] sm:shrink-0">
                        <InputMoneda
                          id={idMonto}
                          aria-label={it.isCustom ? `Monto de ${it.label || "este gasto"}` : undefined}
                          wrapperClassName="min-w-0 flex-1"
                          className="fo-input text-right"
                          placeholder="0"
                          decimales={false}
                          value={it.amount}
                          onChange={(v) => editarRenglon(g.id, it.id, { amount: v })}
                        />
                        {it.isCustom ? (
                          <button
                            type="button"
                            className="fo-btn fo-btn-secondary shrink-0"
                            onClick={() => editar(g.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id) }))}
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="fo-btn fo-btn-secondary"
                    onClick={() => editar(g.id, (x) => ({ ...x, items: [...x.items, { id: createCustomExpenseItemId(g.id), label: "", amount: "", isCustom: true }] }))}
                  >
                    Agregar ítem
                  </button>
                  {deFabrica ? null : (
                    <button type="button" className="fo-btn fo-btn-danger-outline" onClick={() => poner(grupos.filter((x) => x.id !== g.id))}>
                      Quitar grupo
                    </button>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <button type="button" className="fo-btn fo-btn-secondary" onClick={agregarGrupo}>
        Agregar grupo
      </button>
      <div
        role="status"
        className="flex items-center justify-between gap-4 rounded-xl border border-[var(--fo-border-strong)] bg-[var(--fo-surface-muted)] p-4"
      >
        <span className="text-[0.9375rem] font-semibold">Total gastos personales / mes</span>
        <span className="whitespace-nowrap text-lg font-bold tabular-nums text-[var(--fo-accent)]">{pesos(total)}</span>
      </div>
    </Seccion>
  );
}

export function SeccionNegocio({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion>
      <CampoTexto tipo="moneda" etiqueta="Alquiler / estudio mensual" ayuda="Poné 0 si trabajás desde tu casa." valor={perfil.businessRent} onCambio={(v) => cambiar({ businessRent: v })} />
      <CampoTexto tipo="moneda" etiqueta="Software y herramientas" valor={perfil.businessSoftware} onCambio={(v) => cambiar({ businessSoftware: v })} />
      <CampoTexto tipo="moneda" etiqueta="Publicidad y otros gastos fijos (opcional)" valor={perfil.businessMarketing} onCambio={(v) => cambiar({ businessMarketing: v })} />
    </Seccion>
  );
}

export function SeccionColaboradores({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion>
      <CampoTexto etiqueta="Cantidad de empleados o colaboradores fijos" ayuda="Si trabajás sola o solo, poné 0." valor={perfil.employeesCount} onCambio={(v) => cambiar({ employeesCount: v })} />
      {monto(perfil.employeesCount) > 0 ? (
        <CampoTexto tipo="moneda" etiqueta="Costo mensual del equipo" valor={perfil.employeeMonthlyCost} onCambio={(v) => cambiar({ employeeMonthlyCost: v })} />
      ) : null}
    </Seccion>
  );
}

export function SeccionTiempo({ perfil, cambiar }: PropsSeccion) {
  const semanal = Math.round(monto(perfil.weeklyHours));
  const horasDe = (k: (typeof CLAVES_TIEMPO)[number]) => Math.round((semanal * monto(perfil.timeDistribution[k])) / 100);
  const porcentajes = CLAVES_TIEMPO.reduce((s, k) => s + monto(perfil.timeDistribution[k]), 0);
  const asignadas = CLAVES_TIEMPO.reduce((s, k) => s + horasDe(k), 0);
  const ok = isTimeDistributionValid(perfil.timeDistribution, semanal);
  const etiquetas: Record<(typeof CLAVES_TIEMPO)[number], string> = {
    coverage: "Coberturas (%)",
    editing: "Edición (%)",
    administration: "Administración (%)",
    sales: "Ventas (%)",
    marketing: "Publicidad (%)",
    training: "Capacitación (%)",
  };
  return (
    <Seccion>
      <CampoTexto etiqueta="Horas de trabajo por semana" valor={perfil.weeklyHours} onCambio={(v) => cambiar({ weeklyHours: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        {CLAVES_TIEMPO.map((k) => (
          <CampoTexto
            key={k}
            etiqueta={etiquetas[k]}
            valor={perfil.timeDistribution[k]}
            ayuda={[k === "coverage" ? "Lo único que se cobra." : null, semanal > 0 ? `${horasDe(k)} h por semana` : null].filter(Boolean).join(" ") || undefined}
            onCambio={(v) => cambiar({ timeDistribution: { ...perfil.timeDistribution, [k]: v } })}
          />
        ))}
      </div>
      <p role="status" className={"text-sm font-medium " + (ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]")}>
        {semanal > 0
          ? `Asignadas: ${asignadas} de ${semanal} horas${ok ? "" : " (las horas de cada tarea tienen que sumar tus horas por semana)"}`
          : `Total: ${Math.round(porcentajes * 100) / 100}%${ok ? "" : " (tiene que sumar 100%)"}`}
      </p>
    </Seccion>
  );
}

export function SeccionEquipo({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto
          tipo="moneda"
          etiqueta="Inversión mensual en equipo ($)"
          valor={perfil.equipmentRenewalMonthly}
          onCambio={(v) => cambiar({ equipmentRenewalMonthly: v })}
          ayuda="Tarjetas, baterías, lentes y otros equipos. No incluye la cámara: su desgaste se cobra en cada trabajo, según los disparos."
        />
        <CampoTexto etiqueta="Cámara principal" tipo="text" valor={perfil.primaryCameraCustomName} onCambio={(v) => cambiar({ primaryCameraCustomName: v })} />
        <CampoTexto etiqueta="Vida útil del obturador (disparos)" valor={perfil.primaryCameraShutterRating} onCambio={(v) => cambiar({ primaryCameraShutterRating: v })} />
        <CampoTexto etiqueta="Disparos actuales de la cámara" valor={perfil.primaryCameraCurrentShutterCount} onCambio={(v) => cambiar({ primaryCameraCurrentShutterCount: v })} />
        <CampoTexto tipo="moneda" etiqueta="Valor de reposición ($)" valor={perfil.primaryCameraReplacementValue} onCambio={(v) => cambiar({ primaryCameraReplacementValue: v })} />
      </div>
      {perfil.equipmentInventory ? (
        <p className="text-xs text-[var(--fo-muted)]">Tenés un inventario de equipo cargado; se conserva.</p>
      ) : null}
    </Seccion>
  );
}

export function SeccionFondoEmergencia({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion>
      <CampoTexto tipo="moneda" etiqueta="Aporte mensual a fondo de emergencia" ayuda="Reserva para imprevistos personales o del negocio." valor={perfil.emergencyFundMonthly} onCambio={(v) => cambiar({ emergencyFundMonthly: v })} />
    </Seccion>
  );
}

export function SeccionAhorro({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion>
      <Aviso>{CC_SAVINGS_GOALS_INTRO}</Aviso>
      <Aviso>{CC_SAVINGS_GOALS_VS_PERSONAL_VACATIONS}</Aviso>
      <CampoTexto
        tipo="moneda"
        etiqueta="Aporte mensual para vacaciones y objetivos personales"
        ayuda="Ej.: un viaje grande el año que viene, un curso o una meta familiar."
        valor={perfil.savingsGoalsMonthly}
        onCambio={(v) => cambiar({ savingsGoalsMonthly: v })}
      />
    </Seccion>
  );
}

export function SeccionPosicionamiento({ perfil, cambiar }: PropsSeccion) {
  const elegido = perfil.commercialPositioningId || "stable";
  return (
    <Seccion>
      <Aviso>{CC_COMMERCIAL_POSITIONING_INTRO}</Aviso>
      <h4 className="text-[0.9375rem] font-semibold">{CC_COMMERCIAL_POSITIONING_QUESTION}</h4>
      <div className="grid gap-3" role="radiogroup" aria-label={CC_COMMERCIAL_POSITIONING_QUESTION}>
        {COMMERCIAL_POSITIONING_OPTIONS.map((o) => {
          const activo = elegido === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => cambiar({ commercialPositioningId: o.id as CuantoCobroProfileInput["commercialPositioningId"] })}
              className={
                "rounded-xl border p-4 text-left transition-colors " +
                (activo
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] shadow-[0_0_0_1px_var(--fo-accent)]"
                  : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] hover:border-[var(--fo-border-strong)]")
              }
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{o.title}</span>
                {o.isRecommended ? (
                  <span className="rounded-full bg-[var(--fo-accent)] px-2 py-0.5 text-[0.6875rem] font-semibold text-white">Recomendado</span>
                ) : null}
              </span>
              <span className="mt-1 block text-[0.8125rem] leading-snug text-[var(--fo-muted)]">{o.description}</span>
            </button>
          );
        })}
      </div>
    </Seccion>
  );
}
