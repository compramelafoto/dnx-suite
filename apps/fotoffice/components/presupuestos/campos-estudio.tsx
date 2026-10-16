"use client";

import { useId, useState } from "react";
import {
  activeStudioStructure,
  computeStudioBreakdown,
  resolveProfileCameras,
  PRIMARY_CAMERA_ID,
  type CuantoCobroAssignmentActivity,
  type CuantoCobroProfileInput,
  type StudioPerson,
  type StudioSkill,
} from "@repo/cuanto-cobro-core";
import {
  ACTIVIDADES_DEL_TIPO,
  conAsignaciones,
  tercerizadoDePersona,
  type AsignacionPanel,
  type TrabajoPanel,
} from "@/lib/presupuestos/panel-cuanto-cobro";
import { pesos } from "@/lib/presupuestos/editor";

const ETIQUETA_ACTIVIDAD: Record<CuantoCobroAssignmentActivity, string> = {
  coverage: "Cobertura",
  editing: "Edición",
  delivery: "Entrega",
  travel: "Viaje",
  production: "Diseño",
  management: "Gestión",
};

/** Quién sabe hacer qué: las personas con esa habilidad aparecen primero. */
const HABILIDAD_DE_ACTIVIDAD: Partial<Record<CuantoCobroAssignmentActivity, StudioSkill[]>> = {
  coverage: ["photo", "video"],
  editing: ["editing", "retouch"],
  production: ["editing", "printing"],
  management: ["admin"],
};

function ordenadasPara(actividad: CuantoCobroAssignmentActivity, personas: StudioPerson[]): StudioPerson[] {
  const h = HABILIDAD_DE_ACTIVIDAD[actividad] ?? [];
  const sabe = (p: StudioPerson) => (p.skills.some((s) => h.includes(s)) ? 0 : 1);
  return [...personas].sort((a, b) => sabe(a) - sabe(b));
}

const nombreDe = (p: StudioPerson) => p.name.trim() || (p.role === "owner" ? "Yo" : "Sin nombre");

/**
 * Lo propio de «Mi estudio» en un concepto del panel: quién hace cada parte (cada hora a la tarifa de
 * esa persona; lo que no se asigna, al valor hora del estudio), con qué cámara se dispara, la persona
 * «por trabajo» de un tercerizado y la línea del estudio. Sin modo estudio y sin otras cámaras, no dibuja nada.
 */
export function CamposEstudio({ trabajo, onCambio, perfil }: { trabajo: TrabajoPanel; onCambio: (t: TrabajoPanel) => void; perfil: CuantoCobroProfileInput }) {
  const estudio = activeStudioStructure(perfil);
  const desglose = estudio ? computeStudioBreakdown(perfil) : null;
  const camaras = resolveProfileCameras(perfil);
  const idCamara = useId();
  const idLinea = useId();
  const idPorTrabajo = useId();
  const [horasTercerizado, setHorasTercerizado] = useState("");

  const conCamaras = camaras.length > 1 && (trabajo.tipo === "own-service" || trabajo.tipo === "physical-product");
  if (!estudio && !conCamaras) return null;

  const tarifa = new Map((desglose?.people ?? []).map((p) => [p.id, p.rate]));
  const enEstructura = estudio ? estudio.people.filter((p) => (p.role === "owner" || p.active) && p.employmentType !== "per-job") : [];
  const porTrabajo = estudio ? estudio.people.filter((p) => p.active && p.employmentType === "per-job") : [];
  const asignaciones = trabajo.asignaciones ?? [];
  const actividades = estudio ? ACTIVIDADES_DEL_TIPO[trabajo.tipo] : [];

  const poner = (nuevas: AsignacionPanel[]) => onCambio(conAsignaciones(trabajo, nuevas));
  const editar = (i: number, parcial: Partial<AsignacionPanel>) => poner(asignaciones.map((a, j) => (j === i ? { ...a, ...parcial } : a)));

  return (
    <div className="space-y-4 sm:col-span-2">
      {actividades.length > 0 ? (
        <fieldset className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
          <legend className="px-1 text-sm font-semibold">¿Quién lo hace?</legend>
          <p className="text-xs text-[var(--fo-muted)]">
            Cada hora asignada se cobra a la tarifa de esa persona. Lo que no asignes va al valor hora del estudio
            {desglose?.studioHourRate ? ` (${pesos(desglose.studioHourRate)})` : ""}. Dos personas a la vez suman sus horas: 6 h cada una = 12 h.
          </p>
          {actividades.map((actividad) => {
            const filas = asignaciones.map((a, i) => ({ a, i })).filter(({ a }) => a.actividad === actividad);
            return (
              <div key={actividad} className="space-y-2">
                <p className="text-sm font-medium">{ETIQUETA_ACTIVIDAD[actividad]}</p>
                {filas.map(({ a, i }) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Persona para ${ETIQUETA_ACTIVIDAD[actividad].toLowerCase()}`}
                      className="fo-input min-w-0 flex-1"
                      value={a.persona}
                      onChange={(e) => editar(i, { persona: e.target.value })}
                    >
                      {ordenadasPara(actividad, enEstructura).map((p) => (
                        <option key={p.id} value={p.id}>
                          {nombreDe(p)}
                          {tarifa.get(p.id) ? ` · ${pesos(tarifa.get(p.id)!)} la hora` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Horas"
                      className="fo-input w-24"
                      inputMode="decimal"
                      placeholder="Horas"
                      value={a.horas}
                      onChange={(e) => editar(i, { horas: e.target.value })}
                    />
                    <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => poner(asignaciones.filter((_, j) => j !== i))}>
                      Quitar
                    </button>
                  </div>
                ))}
                {enEstructura.length > 0 ? (
                  <button
                    type="button"
                    className="fo-btn fo-btn-ghost text-sm"
                    onClick={() => poner([...asignaciones, { persona: ordenadasPara(actividad, enEstructura)[0]!.id, actividad, horas: "" }])}
                  >
                    + Asignar {ETIQUETA_ACTIVIDAD[actividad].toLowerCase()}
                  </button>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      {estudio && trabajo.tipo === "outsourced" && porTrabajo.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label htmlFor={idPorTrabajo} className="fo-label">
              Lo hace alguien del estudio que cobra por trabajo
            </label>
            <select
              id={idPorTrabajo}
              className="fo-input"
              value={trabajo.tercerizadoPor ?? ""}
              onChange={(e) => {
                const p = porTrabajo.find((x) => x.id === e.target.value);
                onCambio(p ? tercerizadoDePersona(trabajo, p, horasTercerizado) : { ...trabajo, tercerizadoPor: undefined });
              }}
            >
              <option value="">Nadie del estudio</option>
              {porTrabajo.map((p) => (
                <option key={p.id} value={p.id}>
                  {nombreDe(p)}
                </option>
              ))}
            </select>
          </div>
          {porTrabajo.find((p) => p.id === trabajo.tercerizadoPor)?.perJobUnit === "hour" ? (
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${idPorTrabajo}-h`}>
                Horas
              </label>
              <input
                id={`${idPorTrabajo}-h`}
                className="fo-input"
                inputMode="decimal"
                value={horasTercerizado}
                onChange={(e) => {
                  setHorasTercerizado(e.target.value);
                  const p = porTrabajo.find((x) => x.id === trabajo.tercerizadoPor);
                  if (p) onCambio(tercerizadoDePersona(trabajo, p, e.target.value));
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {conCamaras ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label htmlFor={idCamara} className="fo-label">
              Cámara
            </label>
            <select id={idCamara} className="fo-input" value={trabajo.camara || PRIMARY_CAMERA_ID} onChange={(e) => onCambio({ ...trabajo, camara: e.target.value === PRIMARY_CAMERA_ID ? "" : e.target.value })}>
              {camaras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.costPerShot !== null ? ` · ${pesos(c.costPerShot)} por disparo` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <span className="fo-label">Los disparos son</span>
            <div className="flex gap-2">
              {(["unit", "job"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={(trabajo.disparosPor ?? "unit") === m}
                  className={(trabajo.disparosPor ?? "unit") === m ? "fo-btn fo-btn-primary text-sm" : "fo-btn fo-btn-secondary text-sm"}
                  onClick={() => onCambio({ ...trabajo, disparosPor: m === "job" ? "job" : undefined })}
                >
                  {m === "unit" ? "Por unidad" : "Por trabajo"}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--fo-muted)]">Carnet: 3 disparos por unidad. Evento: los disparos del trabajo entero.</p>
          </div>
        </div>
      ) : null}

      {estudio && estudio.businessLines.length > 0 ? (
        <div className="fo-field-stack sm:max-w-sm">
          <label htmlFor={idLinea} className="fo-label">
            Línea del estudio
          </label>
          <select id={idLinea} className="fo-input" value={trabajo.linea ?? ""} onChange={(e) => onCambio({ ...trabajo, linea: e.target.value || undefined })}>
            <option value="">Sin elegir</option>
            {estudio.businessLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name || "Sin nombre"}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
