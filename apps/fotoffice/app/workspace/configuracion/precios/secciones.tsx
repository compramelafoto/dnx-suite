"use client";

import { useId } from "react";
import {
  COMMERCIAL_POSITIONING_OPTIONS,
  parseCuantoCobroAmount,
  type CuantoCobroProfileInput,
  type MonthlyExpenseGroup,
  type PhotographyTimeDistribution,
} from "@repo/cuanto-cobro-core";
import { CampoTexto } from "@/components/presupuestos/panel-cuanto-cobro";
import { pesos } from "@/lib/presupuestos/editor";

/** Cada sección recibe el perfil y un `cambiar` que mezcla un parcial. */
export type PropsSeccion = {
  perfil: CuantoCobroProfileInput;
  cambiar: (parcial: Partial<CuantoCobroProfileInput>) => void;
};

const CLAVES_TIEMPO = ["coverage", "editing", "administration", "sales", "marketing", "training"] as const satisfies readonly (keyof PhotographyTimeDistribution)[];

const monto = (v: string) => parseCuantoCobroAmount(v) ?? 0;

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby={id}>
      <div className="space-y-1">
        <h2 id={id} className="text-base font-semibold">
          {titulo}
        </h2>
        {ayuda ? <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function SeccionIngresos({ perfil, cambiar }: PropsSeccion) {
  const id = useId();
  return (
    <Seccion titulo="Ingresos">
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
          <option value="yes">Sí</option>
          <option value="no">No</option>
        </select>
      </div>
      {perfil.livesOnlyFromPhotography === "no" ? (
        <CampoTexto etiqueta="Otros ingresos del mes ($)" valor={perfil.externalMonthlyIncome} onCambio={(v) => cambiar({ externalMonthlyIncome: v })} />
      ) : null}
    </Seccion>
  );
}

export function SeccionGastosPersonales({ perfil, cambiar }: PropsSeccion) {
  const grupos = perfil.personalExpenseGroups;
  const poner = (g: MonthlyExpenseGroup[]) => cambiar({ personalExpenseGroups: g });
  const editar = (id: string, f: (g: MonthlyExpenseGroup) => MonthlyExpenseGroup) => poner(grupos.map((g) => (g.id === id ? f(g) : g)));
  return (
    <Seccion titulo="Gastos personales" ayuda="Lo que necesitás por mes para vivir, agrupado como quieras.">
      {grupos.map((g) => (
        <fieldset key={g.id} className="space-y-3 rounded-lg border border-[var(--fo-border)] p-3">
          <legend className="px-1 text-xs text-[var(--fo-muted)]">Grupo</legend>
          <CampoTexto etiqueta="Título del grupo" tipo="text" valor={g.title} onCambio={(v) => editar(g.id, (x) => ({ ...x, title: v }))} />
          {g.items.map((it) => (
            <div key={it.id} className="grid items-end gap-2 sm:grid-cols-[1fr_9rem_auto]">
              <CampoTexto
                etiqueta="Etiqueta"
                tipo="text"
                valor={it.label}
                onCambio={(v) => editar(g.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === it.id ? { ...i, label: v } : i)) }))}
              />
              <CampoTexto
                etiqueta="Monto ($)"
                valor={it.amount}
                onCambio={(v) => editar(g.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === it.id ? { ...i, amount: v } : i)) }))}
              />
              <button
                type="button"
                className="fo-btn fo-btn-danger-outline"
                aria-label={`Quitar renglón ${it.label || "sin nombre"}`}
                onClick={() => editar(g.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id) }))}
              >
                Quitar
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                className="fo-btn fo-btn-secondary"
                onClick={() => editar(g.id, (x) => ({ ...x, items: [...x.items, { id: crypto.randomUUID(), label: "", amount: "", isCustom: true }] }))}
              >
                Agregar renglón
              </button>
              <button type="button" className="fo-btn fo-btn-danger-outline" onClick={() => poner(grupos.filter((x) => x.id !== g.id))}>
                Quitar grupo
              </button>
            </div>
            <p className="text-sm">
              Subtotal: <strong>{pesos(g.items.reduce((s, i) => s + monto(i.amount), 0))}</strong>
            </p>
          </div>
        </fieldset>
      ))}
      <button type="button" className="fo-btn fo-btn-secondary" onClick={() => poner([...grupos, { id: crypto.randomUUID(), title: "", items: [] }])}>
        Agregar grupo
      </button>
    </Seccion>
  );
}

export function SeccionNegocio({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion titulo="Negocio" ayuda="Gastos fijos mensuales del estudio.">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto etiqueta="Alquiler ($)" valor={perfil.businessRent} onCambio={(v) => cambiar({ businessRent: v })} />
        <CampoTexto etiqueta="Software ($)" valor={perfil.businessSoftware} onCambio={(v) => cambiar({ businessSoftware: v })} />
        <CampoTexto etiqueta="Publicidad ($)" valor={perfil.businessMarketing} onCambio={(v) => cambiar({ businessMarketing: v })} />
        <CampoTexto etiqueta="Colaboradores (cantidad)" valor={perfil.employeesCount} onCambio={(v) => cambiar({ employeesCount: v })} />
        {monto(perfil.employeesCount) > 0 ? (
          <CampoTexto etiqueta="Costo mensual del equipo ($)" valor={perfil.employeeMonthlyCost} onCambio={(v) => cambiar({ employeeMonthlyCost: v })} />
        ) : null}
      </div>
    </Seccion>
  );
}

export function SeccionTiempo({ perfil, cambiar }: PropsSeccion) {
  const total = CLAVES_TIEMPO.reduce((s, k) => s + monto(perfil.timeDistribution[k]), 0);
  const ok = Math.abs(total - 100) < 0.005;
  const etiquetas: Record<(typeof CLAVES_TIEMPO)[number], string> = {
    coverage: "Coberturas (%)",
    editing: "Edición (%)",
    administration: "Administración (%)",
    sales: "Ventas (%)",
    marketing: "Publicidad (%)",
    training: "Capacitación (%)",
  };
  return (
    <Seccion titulo="Tiempo" ayuda="Cómo repartís tus horas de trabajo. Coberturas es lo único que se cobra.">
      <CampoTexto etiqueta="Horas de trabajo por semana" valor={perfil.weeklyHours} onCambio={(v) => cambiar({ weeklyHours: v })} />
      <div className="grid gap-3 sm:grid-cols-2">
        {CLAVES_TIEMPO.map((k) => (
          <CampoTexto
            key={k}
            etiqueta={etiquetas[k]}
            valor={perfil.timeDistribution[k]}
            ayuda={k === "coverage" ? "Lo único que se cobra." : undefined}
            onCambio={(v) => cambiar({ timeDistribution: { ...perfil.timeDistribution, [k]: v } })}
          />
        ))}
      </div>
      <p role="status" className={"text-sm font-medium " + (ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]")}>
        Total: {Math.round(total * 100) / 100}% {ok ? "" : "(tiene que sumar 100%)"}
      </p>
    </Seccion>
  );
}

export function SeccionEquipo({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion titulo="Equipo" ayuda="Cuánto apartás para renovar y qué desgaste tiene tu cámara principal.">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto etiqueta="Renovación mensual de equipo ($)" valor={perfil.equipmentRenewalMonthly} onCambio={(v) => cambiar({ equipmentRenewalMonthly: v })} />
        <CampoTexto etiqueta="Cámara principal" tipo="text" valor={perfil.primaryCameraCustomName} onCambio={(v) => cambiar({ primaryCameraCustomName: v })} />
        <CampoTexto etiqueta="Vida útil del obturador (disparos)" valor={perfil.primaryCameraShutterRating} onCambio={(v) => cambiar({ primaryCameraShutterRating: v })} />
        <CampoTexto etiqueta="Disparos actuales" valor={perfil.primaryCameraCurrentShutterCount} onCambio={(v) => cambiar({ primaryCameraCurrentShutterCount: v })} />
        <CampoTexto etiqueta="Valor de reposición ($)" valor={perfil.primaryCameraReplacementValue} onCambio={(v) => cambiar({ primaryCameraReplacementValue: v })} />
      </div>
      {perfil.equipmentInventory ? (
        <p className="text-xs text-[var(--fo-muted)]">Tenés un inventario de equipo cargado; se conserva.</p>
      ) : null}
    </Seccion>
  );
}

export function SeccionReservas({ perfil, cambiar }: PropsSeccion) {
  return (
    <Seccion titulo="Reservas" ayuda="Lo que apartás cada mes.">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto etiqueta="Fondo de emergencia ($)" valor={perfil.emergencyFundMonthly} onCambio={(v) => cambiar({ emergencyFundMonthly: v })} />
        <CampoTexto etiqueta="Ahorro y vacaciones ($)" valor={perfil.savingsGoalsMonthly} onCambio={(v) => cambiar({ savingsGoalsMonthly: v })} />
      </div>
    </Seccion>
  );
}

export function SeccionPosicionamiento({ perfil, cambiar }: PropsSeccion) {
  const id = useId();
  const elegida = COMMERCIAL_POSITIONING_OPTIONS.find((o) => o.id === perfil.commercialPositioningId);
  return (
    <Seccion titulo="Posicionamiento" ayuda="El momento de tu negocio. Nunca baja tu precio mínimo; ayuda a sugerir uno más realista.">
      <div className="fo-field-stack">
        <label htmlFor={id} className="fo-label">
          ¿Cómo describirías hoy el momento de tu negocio?
        </label>
        <select
          id={id}
          className="fo-input"
          value={perfil.commercialPositioningId}
          onChange={(e) => cambiar({ commercialPositioningId: e.target.value as CuantoCobroProfileInput["commercialPositioningId"] })}
        >
          <option value="">Elegí una opción</option>
          {COMMERCIAL_POSITIONING_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
        {elegida?.description ? <p className="text-xs text-[var(--fo-muted)]">{elegida.description}</p> : null}
      </div>
    </Seccion>
  );
}
