"use client";

import { useId } from "react";
import {
  computeStudioBreakdown,
  createCamera,
  createStudioPerson,
  INITIAL_STUDIO_STRUCTURE,
  MAX_EXTRA_CAMERAS,
  normalizeStudioStructure,
  parseCuantoCobroAmount,
  STUDIO_EMPLOYMENT_TYPES,
  STUDIO_MAX_PEOPLE,
  STUDIO_SKILLS,
  type CuantoCobroCamera,
  type CuantoCobroStudioBreakdown,
  type CuantoCobroStudioStructure,
  type StudioEmploymentType,
  type StudioFixedCostGroup,
  type StudioPerson,
  type StudioSkill,
} from "@repo/cuanto-cobro-core";
import { InputMoneda } from "@/components/campos/input-moneda";
import { CampoTexto } from "@/components/presupuestos/panel-cuanto-cobro";
import { diasConSabadosAlternados, retiroSugerido } from "@/lib/precios/estudio";
import type { MiembroParaVincular } from "@/lib/precios/estudio-servidor";
import { pesos } from "@/lib/presupuestos/editor";
import { Aviso, SeccionEquipo, type PropsSeccion } from "./secciones";

export type PropsSeccionEstudio = PropsSeccion & { miembros?: MiembroParaVincular[] };

export const ETIQUETA_CONTRATACION: Record<Exclude<StudioEmploymentType, "">, string> = {
  employee: "Relación de dependencia (registrada)",
  informal: "Sin registrar, con aguinaldo y vacaciones pagas",
  monotributista: "Monotributista (factura fija por mes)",
  daily: "Jornal (por día trabajado)",
  "per-job": "Por trabajo",
};

const ETIQUETA_HABILIDAD: Record<StudioSkill, string> = {
  photo: "Fotografía",
  video: "Video",
  editing: "Edición",
  retouch: "Retoque",
  printing: "Impresión",
  "front-desk": "Atención al público",
  social: "Redes",
  admin: "Administración",
};

const monto = (v: string) => parseCuantoCobroAmount(v) ?? 0;
const horas = (h: number) => `${Math.round(h * 10) / 10} h`.replace(".", ",");

/** El bloque del perfil (siempre completo: el formulario lo enciende con `encenderMiEstudio`). */
function bloque(perfil: PropsSeccion["perfil"]): CuantoCobroStudioStructure {
  return normalizeStudioStructure(perfil.studioStructure) ?? { ...INITIAL_STUDIO_STRUCTURE, enabled: true };
}

function useEstudio({ perfil, cambiar }: PropsSeccion) {
  const s = bloque(perfil);
  const poner = (parcial: Partial<CuantoCobroStudioStructure>) => cambiar({ studioStructure: { ...s, ...parcial } });
  const editarPersona = (id: string, parcial: Partial<StudioPerson>) =>
    poner({ people: s.people.map((p) => (p.id === id ? { ...p, ...parcial } : p)) });
  return { s, poner, editarPersona, desglose: computeStudioBreakdown(perfil) };
}

function Total({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div role="status" className="flex items-center justify-between gap-4 rounded-xl border border-[var(--fo-border-strong)] bg-[var(--fo-surface-muted)] p-4">
      <span className="text-[0.9375rem] font-semibold">{etiqueta}</span>
      <span className="whitespace-nowrap text-lg font-bold tabular-nums text-[var(--fo-accent)]">{valor}</span>
    </div>
  );
}

// ── Paso 1 · Gastos fijos del estudio ────────────────────────────────────────────────────────────

export function SeccionGastosFijos(props: PropsSeccionEstudio) {
  const { s, poner, desglose } = useEstudio(props);
  const grupos = s.fixedCostGroups;
  const editar = (id: string, f: (g: StudioFixedCostGroup) => StudioFixedCostGroup) => poner({ fixedCostGroups: grupos.map((g) => (g.id === id ? f(g) : g)) });
  const nuevoRenglon = (g: StudioFixedCostGroup) => ({ id: `${g.id}-custom-${crypto.randomUUID()}`, label: "", amount: "", isCustom: true });
  const extras = props.perfil.pricingExtras;
  const monotributo = monto(extras?.monotributoMonthly ?? "");
  const seguro = monto(extras?.equipmentInsuranceAnnual ?? "");
  return (
    <div className="space-y-5">
      <Aviso>
        Lo que pagás todos los meses haya trabajo o no. Los sueldos van en <strong>Equipo</strong>, tu retiro en <strong>Vos en el estudio</strong> y la
        inversión en lentes o tarjetas en <strong>Equipamiento</strong>. El monotributo y el seguro del equipo se cargan en <strong>Impuestos, cobros y recargos</strong>:
        no los repitas acá.
      </Aviso>
      <div className="space-y-2.5">
        {grupos.map((g) => {
          const subtotal = g.items.reduce((t, i) => t + monto(i.amount), 0);
          return (
            <details key={g.id} className="group overflow-hidden rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]" open={subtotal > 0 || undefined}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="mr-1 h-2 w-2 shrink-0 -rotate-45 border-b-2 border-r-2 border-[var(--fo-accent)] transition-transform group-open:rotate-45" />
                <span className="min-w-0 flex-1 text-[0.9375rem]">{g.title || "Rubro"}</span>
                <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-[var(--fo-accent)]">{pesos(subtotal)}</span>
              </summary>
              <div className="border-t border-[var(--fo-border)] px-4 pb-4">
                {g.items.map((it) => (
                  <div key={it.id} className="flex flex-col gap-2 border-b border-[var(--fo-border)] py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      {it.isCustom ? (
                        <input
                          className="fo-input"
                          aria-label="Nombre del gasto"
                          placeholder="Nombre del gasto"
                          value={it.label}
                          onChange={(e) => editar(g.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === it.id ? { ...i, label: e.target.value } : i)) }))}
                        />
                      ) : (
                        <label htmlFor={`fijo-${it.id}`} className="block text-sm leading-snug">
                          {it.label}
                        </label>
                      )}
                    </div>
                    <div className="flex w-full items-stretch gap-2 sm:w-auto sm:min-w-[12rem] sm:shrink-0">
                      <InputMoneda
                        id={`fijo-${it.id}`}
                        aria-label={it.isCustom ? `Monto de ${it.label || "este gasto"}` : undefined}
                        wrapperClassName="min-w-0 flex-1"
                        className="fo-input text-right"
                        placeholder="0"
                        decimales={false}
                        value={it.amount}
                        onChange={(v) => editar(g.id, (x) => ({ ...x, items: x.items.map((i) => (i.id === it.id ? { ...i, amount: v } : i)) }))}
                      />
                      {it.isCustom ? (
                        <button type="button" className="fo-btn fo-btn-secondary shrink-0" onClick={() => editar(g.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id) }))}>
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <button type="button" className="fo-btn fo-btn-secondary" onClick={() => editar(g.id, (x) => ({ ...x, items: [...x.items, nuevoRenglon(x)] }))}>
                    Agregar gasto
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
      {monotributo > 0 || seguro > 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Ya cargado en «Impuestos, cobros y recargos» (se suma solo):
          {monotributo > 0 ? ` monotributo ${pesos(monotributo)} por mes` : ""}
          {monotributo > 0 && seguro > 0 ? " ·" : ""}
          {seguro > 0 ? ` seguro del equipo ${pesos(seguro / 12)} por mes` : ""}.
        </p>
      ) : null}
      <Total etiqueta="Gastos fijos del estudio / mes" valor={pesos(desglose?.fixedCosts ?? 0)} />
    </div>
  );
}

// ── Paso 2 · Equipo ──────────────────────────────────────────────────────────────────────────────

function SelectorMiembro({ persona, miembros, ocupados, onCambio }: { persona: StudioPerson; miembros: MiembroParaVincular[]; ocupados: Set<number>; onCambio: (userId: number | null) => void }) {
  const id = useId();
  return (
    <div className="fo-field-stack">
      <label htmlFor={id} className="fo-label">
        Su usuario en FOTOFFICE (opcional)
      </label>
      <select
        id={id}
        className="fo-input"
        value={persona.link?.userId ?? ""}
        onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Sin vincular</option>
        {miembros.map((m) => (
          <option key={m.userId} value={m.userId} disabled={ocupados.has(m.userId) && persona.link?.userId !== m.userId}>
            {m.etiqueta}
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--fo-muted)]">Sólo para reconocerla en otras pantallas. Si todavía no tiene usuario, dejalo sin vincular: no se le manda ninguna invitación.</p>
    </div>
  );
}

function CampoDias({ valor, onCambio, etiqueta = "Días por semana" }: { valor: string; onCambio: (v: string) => void; etiqueta?: string }) {
  const opciones: [string, string][] = [
    ["5", "5"],
    [diasConSabadosAlternados(5), "5 + sábados alternados"],
    ["6", "6"],
  ];
  return (
    <div className="space-y-2">
      <CampoTexto tipo="text" etiqueta={etiqueta} ayuda="Admite medio día: 5 días + sábados alternados = 5,5." valor={valor} onCambio={onCambio} />
      <div className="flex flex-wrap gap-2" aria-label="Atajos de días por semana">
        {opciones.map(([v, t]) => (
          <button key={v} type="button" className={valor === v ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"} onClick={() => onCambio(v)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function LineaPersona({ fila }: { fila: CuantoCobroStudioBreakdown["people"][number] | undefined }) {
  if (!fila) return null;
  if (!fila.inStructure) {
    return <p className="text-sm text-[var(--fo-muted)]">No suma a los gastos fijos ni a las horas del estudio. Al cotizar entra como trabajo tercerizado.</p>;
  }
  return (
    <p role="status" className="text-sm leading-relaxed">
      Cuesta <strong>{pesos(fila.monthlyCost)} por mes</strong> y puede cobrar <strong>{horas(fila.billableHours)} por mes</strong>
      {fila.costPerHour !== null ? (
        <>
          . Su costo por hora es {pesos(fila.costPerHour)}
          {fila.rate !== null ? (
            <>
              ; con su parte de la estructura, <strong className="text-[var(--fo-accent)]">su hora se cobra {pesos(fila.rate)}</strong>
            </>
          ) : null}
          .
        </>
      ) : (
        <>. Sin horas para cobrar: su costo se reparte entre las horas del resto.</>
      )}
    </p>
  );
}

function TarjetaPersona({ persona, props, numero }: { persona: StudioPerson; props: PropsSeccionEstudio; numero: number }) {
  const { s, poner, editarPersona, desglose } = useEstudio(props);
  const idTipo = useId();
  const cambiar = (parcial: Partial<StudioPerson>) => editarPersona(persona.id, parcial);
  const tipo = persona.employmentType;
  const ocupados = new Set(s.people.flatMap((p) => (p.link ? [p.link.userId] : [])));
  const conSueldo = tipo === "employee" || tipo === "informal";
  return (
    <fieldset className="space-y-4 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-4">
      <legend className="px-1 text-sm font-semibold">{persona.name.trim() || `Persona ${numero}`}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto tipo="text" etiqueta="Nombre" valor={persona.name} onCambio={(v) => cambiar({ name: v })} />
        <CampoTexto tipo="text" etiqueta="Qué hace" ayuda="Ej.: asistente de fotografía, edición y atención." valor={persona.jobTitle} onCambio={(v) => cambiar({ jobTitle: v })} />
      </div>
      <SelectorMiembro persona={persona} miembros={props.miembros ?? []} ocupados={ocupados} onCambio={(userId) => cambiar({ link: userId ? { kind: "member", userId } : undefined })} />
      <div>
        <p className="fo-label">Sabe hacer</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {STUDIO_SKILLS.map((h) => {
            const activa = persona.skills.includes(h);
            return (
              <button
                key={h}
                type="button"
                aria-pressed={activa}
                className={"rounded-full border px-3 py-1.5 text-xs " + (activa ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] font-semibold" : "border-[var(--fo-border)]")}
                onClick={() => cambiar({ skills: activa ? persona.skills.filter((x) => x !== h) : [...persona.skills, h] })}
              >
                {ETIQUETA_HABILIDAD[h]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="fo-field-stack">
        <label htmlFor={idTipo} className="fo-label">
          Cómo está contratada
        </label>
        <select id={idTipo} className="fo-input" value={tipo} onChange={(e) => {
          const nuevo = e.target.value as StudioEmploymentType;
          // Sin registrar: aguinaldo y vacaciones pagas, sin cargas.
          cambiar(nuevo === "informal" ? { employmentType: nuevo, includeSac: true, paidVacations: true, socialChargesPercent: "" } : { employmentType: nuevo });
        }}>
          <option value="">Elegí una opción</option>
          {STUDIO_EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_CONTRATACION[t]}
            </option>
          ))}
        </select>
      </div>
      {tipo ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {conSueldo ? <CampoTexto tipo="moneda" etiqueta="Sueldo por mes" valor={persona.monthlySalary} onCambio={(v) => cambiar({ monthlySalary: v })} /> : null}
          {tipo === "employee" ? (
            <CampoTexto
              tipo="text"
              etiqueta="Cargas sociales (%)"
              ayuda="Aportes patronales, ART y seguro de vida. Suele andar entre 25 % y 30 %: confirmalo con tu contador."
              valor={persona.socialChargesPercent}
              onCambio={(v) => cambiar({ socialChargesPercent: v })}
            />
          ) : null}
          {tipo === "monotributista" ? <CampoTexto tipo="moneda" etiqueta="Lo que factura por mes" valor={persona.monthlySalary} onCambio={(v) => cambiar({ monthlySalary: v })} /> : null}
          {tipo === "daily" ? <CampoTexto tipo="moneda" etiqueta="Jornal por día" valor={persona.dailyRate} onCambio={(v) => cambiar({ dailyRate: v })} /> : null}
          {tipo === "per-job" ? (
            <>
              <CampoTexto tipo="moneda" etiqueta="Cuánto cobra" valor={persona.perJobRate} onCambio={(v) => cambiar({ perJobRate: v })} />
              <div className="fo-field-stack">
                <span className="fo-label">Por</span>
                <div className="flex gap-2">
                  {(["hour", "job"] as const).map((u) => (
                    <button key={u} type="button" className={persona.perJobUnit === u ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"} onClick={() => cambiar({ perJobUnit: u })}>
                      {u === "hour" ? "Hora" : "Trabajo"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {conSueldo || tipo === "daily" ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {conSueldo ? (
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={persona.includeSac} onChange={(e) => cambiar({ includeSac: e.target.checked })} />
              Cobra aguinaldo
            </label>
          ) : null}
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={persona.paidVacations} onChange={(e) => cambiar({ paidVacations: e.target.checked })} />
            Las vacaciones se pagan
          </label>
        </div>
      ) : null}
      {tipo && tipo !== "per-job" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDias valor={persona.workdaysPerWeek} onCambio={(v) => cambiar({ workdaysPerWeek: v })} />
          <CampoTexto tipo="text" etiqueta="Horas por día" valor={persona.hoursPerWorkday} onCambio={(v) => cambiar({ hoursPerWorkday: v })} />
          <CampoTexto tipo="text" etiqueta="Semanas de vacaciones por año" ayuda="Bajan las horas que puede cobrar." valor={persona.vacationWeeksPerYear} onCambio={(v) => cambiar({ vacationWeeksPerYear: v })} />
          <CampoTexto
            tipo="text"
            etiqueta="% de su tiempo que se puede cobrar"
            ayuda="De sus horas, ¿cuántas terminan en un presupuesto? Sesiones, eventos, edición, retoque, impresión. No cuentes atender el teléfono, ordenar o redes. Vacío = 70 %."
            valor={persona.billablePercent}
            onCambio={(v) => cambiar({ billablePercent: v })}
          />
          <CampoTexto tipo="moneda" etiqueta="Insumos y gastos por mes" ayuda="Viáticos, celular, uniforme, capacitación." valor={persona.monthlySupplies} onCambio={(v) => cambiar({ monthlySupplies: v })} />
        </div>
      ) : null}
      <LineaPersona fila={desglose?.people.find((p) => p.id === persona.id)} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fo-border)] pt-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={persona.active} onChange={(e) => cambiar({ active: e.target.checked })} />
          Activa (si está de licencia o ya no trabaja, destildala)
        </label>
        <button type="button" className="fo-btn fo-btn-danger-outline" onClick={() => poner({ people: s.people.filter((p) => p.id !== persona.id) })}>
          Quitar
        </button>
      </div>
    </fieldset>
  );
}

export function SeccionEquipoEstudio(props: PropsSeccionEstudio) {
  const { s, poner, desglose } = useEstudio(props);
  const equipo = s.people.filter((p) => p.role !== "owner");
  return (
    <div className="space-y-5">
      <Aviso>
        Una tarjeta por persona (vos tenés tu propio paso). Con su contratación y su jornada, el sistema calcula cuánto cuesta cada una por mes, cuántas horas
        puede cobrar y cuánto vale su hora.
      </Aviso>
      {equipo.map((p, i) => (
        <TarjetaPersona key={p.id} persona={p} props={props} numero={i + 1} />
      ))}
      {s.people.length < STUDIO_MAX_PEOPLE ? (
        <button type="button" className="fo-btn fo-btn-secondary" onClick={() => poner({ people: [...s.people, createStudioPerson()] })}>
          Sumar una persona
        </button>
      ) : null}
      <Total etiqueta="Equipo / mes" valor={pesos(desglose?.teamCost ?? 0)} />
    </div>
  );
}

// ── Paso 3 · Vos en el estudio ───────────────────────────────────────────────────────────────────

export function SeccionVosEnElEstudio(props: PropsSeccionEstudio) {
  const { s, poner, editarPersona, desglose } = useEstudio(props);
  const owner = s.people.find((p) => p.role === "owner");
  const sugerido = retiroSugerido(props.perfil);
  if (!owner) return null;
  const cambiar = (parcial: Partial<StudioPerson>) => editarPersona(owner.id, parcial);
  const ocupados = new Set(s.people.flatMap((p) => (p.link ? [p.link.userId] : [])));
  return (
    <div className="space-y-5">
      <CampoTexto tipo="moneda" etiqueta="Tu retiro por mes" ayuda="Lo que te llevás vos, aparte de los gastos del estudio." valor={s.ownerDrawMonthly} onCambio={(v) => poner({ ownerDrawMonthly: v })} />
      {sugerido > 0 && monto(s.ownerDrawMonthly) !== sugerido ? (
        <button type="button" className="fo-btn fo-btn-secondary" onClick={() => poner({ ownerDrawMonthly: String(Math.round(sugerido)) })}>
          Usar mis gastos personales ({pesos(sugerido)})
        </button>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoDias valor={owner.workdaysPerWeek} onCambio={(v) => cambiar({ workdaysPerWeek: v })} etiqueta="Tus días por semana" />
        <CampoTexto tipo="text" etiqueta="Tus horas por día" valor={owner.hoursPerWorkday} onCambio={(v) => cambiar({ hoursPerWorkday: v })} />
        <CampoTexto tipo="text" etiqueta="Semanas de vacaciones por año" valor={owner.vacationWeeksPerYear} onCambio={(v) => cambiar({ vacationWeeksPerYear: v })} />
        <CampoTexto
          tipo="text"
          etiqueta="% de tu tiempo que se puede cobrar"
          ayuda="Vos también vendés, administrás y atendés: contá sólo lo que termina en un presupuesto. Vacío = 70 %."
          valor={owner.billablePercent}
          onCambio={(v) => cambiar({ billablePercent: v })}
        />
      </div>
      <SelectorMiembro persona={owner} miembros={props.miembros ?? []} ocupados={ocupados} onCambio={(userId) => cambiar({ link: userId ? { kind: "member", userId } : undefined })} />
      <LineaPersona fila={desglose?.people.find((p) => p.id === owner.id)} />
    </div>
  );
}

// ── Equipamiento (modo estudio): el de siempre + otras cámaras ───────────────────────────────────

export function SeccionEquipoYCamaras(props: PropsSeccionEstudio) {
  const { perfil, cambiar } = props;
  const camaras = perfil.cameras ?? [];
  const poner = (c: CuantoCobroCamera[]) => cambiar({ cameras: c });
  const editar = (id: string, parcial: Partial<CuantoCobroCamera>) => poner(camaras.map((c) => (c.id === id ? { ...c, ...parcial } : c)));
  return (
    <div className="space-y-6">
      <SeccionEquipo perfil={perfil} cambiar={cambiar} />
      <div className="space-y-3">
        <h3 className="text-[0.9375rem] font-semibold">Otras cámaras</h3>
        <p className="text-sm text-[var(--fo-muted)]">
          La de arriba es tu cámara principal (la #1). Si en el estudio hay otras (por ejemplo, la de carnets), cargalas acá: al cotizar, cada producto o servicio
          puede elegir con cuál se hace y cuántos disparos lleva.
        </p>
        {camaras.map((c, i) => {
          const vida = monto(c.shutterRating);
          const valor = monto(c.replacementValue);
          return (
            <fieldset key={c.id} className="space-y-3 rounded-xl border border-[var(--fo-border)] p-4">
              <legend className="px-1 text-sm font-semibold">{c.name.trim() || `Cámara ${i + 2}`}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoTexto tipo="text" etiqueta="Nombre" valor={c.name} onCambio={(v) => editar(c.id, { name: v })} />
                <CampoTexto tipo="moneda" etiqueta="Valor de reposición" valor={c.replacementValue} onCambio={(v) => editar(c.id, { replacementValue: v })} />
                <CampoTexto etiqueta="Vida útil del obturador (disparos)" valor={c.shutterRating} onCambio={(v) => editar(c.id, { shutterRating: v })} />
                <CampoTexto etiqueta="Disparos actuales" valor={c.currentShutterCount} onCambio={(v) => editar(c.id, { currentShutterCount: v })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="text-sm">
                  {vida > 0 && valor > 0 ? `Cada disparo cuesta ${pesos(valor / vida)}.` : "Con el valor y la vida útil se calcula el desgaste por disparo."}
                </p>
                <button type="button" className="fo-btn fo-btn-danger-outline" onClick={() => poner(camaras.filter((x) => x.id !== c.id))}>
                  Quitar
                </button>
              </div>
            </fieldset>
          );
        })}
        {camaras.length < MAX_EXTRA_CAMERAS ? (
          <button type="button" className="fo-btn fo-btn-secondary" onClick={() => poner([...camaras, createCamera()])}>
            Sumar una cámara
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Paso · Otras líneas y ganancia ───────────────────────────────────────────────────────────────

export function SeccionOtrasLineas(props: PropsSeccionEstudio) {
  const { s, poner } = useEstudio(props);
  const lineas = s.businessLines;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-[0.9375rem] font-semibold">Líneas del estudio</h3>
        <p className="text-sm text-[var(--fo-muted)]">Sirven para etiquetar presupuestos; más adelante, con Caja, para medir cuánto deja cada una.</p>
        {lineas.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="fo-input min-w-0 flex-1"
              aria-label="Nombre de la línea"
              value={l.name}
              onChange={(e) => poner({ businessLines: lineas.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)) })}
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={l.sellsHours} onChange={(e) => poner({ businessLines: lineas.map((x) => (x.id === l.id ? { ...x, sellsHours: e.target.checked } : x)) })} />
              Vende horas
            </label>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => poner({ businessLines: lineas.filter((x) => x.id !== l.id) })}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="fo-btn fo-btn-secondary" onClick={() => poner({ businessLines: [...lineas, { id: `line-${crypto.randomUUID()}`, name: "", sellsHours: true }] })}>
          Agregar línea
        </button>
      </div>
      <CampoTexto
        tipo="moneda"
        etiqueta="Lo que dejan por mes las líneas que no venden horas"
        ayuda="Lo que te queda de impresiones, productos o cursos después de pagar sus costos. Ya paga una parte del local: se descuenta de lo que tienen que cubrir las horas. Si no sabés, dejalo en cero."
        valor={s.otherLinesMonthlyContribution}
        onCambio={(v) => poner({ otherLinesMonthlyContribution: v })}
      />
      <div className="space-y-3">
        <h3 className="text-[0.9375rem] font-semibold">Ganancia del estudio</h3>
        <p className="text-sm text-[var(--fo-muted)]">
          Aparte de tu retiro: lo que el estudio deja para reinvertir o para un mes malo. Entra en el precio mínimo. El posicionamiento comercial se suma después, sólo
          al precio recomendado.
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo se carga la ganancia">
          {(["amount", "percent"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={s.desiredProfitMode === m} className={s.desiredProfitMode === m ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"} onClick={() => poner({ desiredProfitMode: m })}>
              {m === "amount" ? "Un monto por mes" : "Un porcentaje"}
            </button>
          ))}
        </div>
        {s.desiredProfitMode === "amount" ? (
          <CampoTexto tipo="moneda" etiqueta="Ganancia por mes" valor={s.desiredProfitMonthly} onCambio={(v) => poner({ desiredProfitMonthly: v })} />
        ) : (
          <CampoTexto tipo="text" etiqueta="Ganancia (%) sobre la estructura" valor={s.desiredProfitPercent} onCambio={(v) => poner({ desiredProfitPercent: v })} />
        )}
      </div>
    </div>
  );
}

// ── Paso final · Resumen del estudio ─────────────────────────────────────────────────────────────

export function SeccionResumenEstudio(props: PropsSeccionEstudio) {
  const { desglose: d } = useEstudio(props);
  if (!d) return null;
  const filas: [string, number][] = [
    ["Gastos fijos del estudio", d.fixedCosts],
    ["Equipo", d.teamCost],
    ["Reservas (equipamiento y fondo de emergencia)", d.reserves],
    ...(d.fixedFromExtras > 0 ? ([["Monotributo y seguro del equipo", d.fixedFromExtras]] as [string, number][]) : []),
    ["Tu retiro", d.ownerDraw],
    ...(d.otherLinesContribution > 0 ? ([["− Lo que dejan otras líneas", -d.otherLinesContribution]] as [string, number][]) : []),
    ["+ Ganancia del estudio", d.profit],
  ];
  const enEstructura = d.people.filter((p) => p.inStructure);
  return (
    <div className="space-y-5">
      <table className="w-full text-sm">
        <tbody>
          {filas.map(([t, v]) => (
            <tr key={t} className="border-b border-[var(--fo-border)]">
              <td className="py-2">{t}</td>
              <td className="py-2 text-right tabular-nums">{pesos(v)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-semibold">Lo que tienen que cubrir las horas</td>
            <td className="py-2 text-right font-bold tabular-nums">{pesos(d.monthlyNeed)}</td>
          </tr>
          <tr>
            <td className="py-2">Horas que el equipo puede cobrar por mes</td>
            <td className="py-2 text-right tabular-nums">{horas(d.capacityHours)}</td>
          </tr>
        </tbody>
      </table>
      <Total etiqueta="Valor hora del estudio" valor={d.studioHourRate === null ? "—" : pesos(d.studioHourRate)} />
      <div>
        <h3 className="text-[0.9375rem] font-semibold">¿Cuánto vale una hora de cada uno?</h3>
        <ul className="mt-2 divide-y divide-[var(--fo-border)] text-sm">
          {enEstructura.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 py-2">
              <span>
                {p.name.trim() || (p.role === "owner" ? "Vos" : "Sin nombre")} <span className="text-[var(--fo-muted)]">· {horas(p.billableHours)} por mes</span>
              </span>
              <span className="font-semibold tabular-nums">{p.rate === null ? "—" : pesos(p.rate)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--fo-muted)]">
          Al cotizar, las horas que le asignes a alguien se cobran a su valor; las que no asignes, al valor hora del estudio (el promedio).
        </p>
      </div>
      {d.warnings.length > 0 ? (
        <Aviso tono="alerta">
          <ul className="list-disc space-y-1 pl-5">
            {d.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}
    </div>
  );
}
