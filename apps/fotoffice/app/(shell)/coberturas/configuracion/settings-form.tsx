"use client";

import { useActionState } from "react";
import {
  allRequestSections,
  REQUEST_FIELD_STATES,
  REQUEST_FIELD_STATE_LABELS,
  requestFieldStateInputName,
} from "@/lib/coverages/request-fields";
import { ASSIGNMENT_MODES, ASSIGNMENT_MODE_LABELS, type CoverageSettingsShape } from "@/lib/coverages/settings";
import { saveCoverageSettingsAction, type PanelState } from "../actions";

const inicial: PanelState = { error: null, ok: null };

/**
 * La configuración del módulo para esta organización.
 *
 * Los `name` de cada campo tienen que coincidir exactamente con los que lee
 * `saveCoverageSettingsAction`: son el contrato entre las dos mitades, y un nombre que no
 * coincide no da error, simplemente guarda el valor por omisión sin que nadie se entere.
 */
export function SettingsForm({ settings }: { settings: CoverageSettingsShape }) {
  const [state, action, guardando] = useActionState(saveCoverageSettingsAction, inicial);

  return (
    <form action={action} className="space-y-6">
      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Cómo se llaman las cosas acá</legend>
        <Texto name="moduleLabel" label="Nombre del módulo" valor={settings.moduleLabel} placeholder="Solicitudes y Coberturas" />
        <Texto name="termRequest" label="Cómo le dicen a un pedido" valor={settings.termRequest} placeholder="Solicitud" />
        <Texto name="termCollaborator" label="Cómo le dicen a quien hace el trabajo" valor={settings.termCollaborator} placeholder="Colaborador/a" />
        <Texto name="termRequester" label="Cómo le dicen a quien lo pide" valor={settings.termRequester} placeholder="Solicitante" />
        <Texto name="termCall" label="Cómo le dicen a una convocatoria" valor={settings.termCall} placeholder="Convocatoria" />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Cómo se arma el equipo</legend>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Modalidad</span>
          <select
            name="assignmentMode"
            defaultValue={settings.assignmentMode}
            className="w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 text-sm"
          >
            {ASSIGNMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {ASSIGNMENT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <Tilde name="requiresApproval" label="Un pedido necesita aprobación antes de convertirse en trabajo" valor={settings.requiresApproval} />
        <Tilde name="requiresCoordinatorConfirmation" label="Postularse no alcanza: un coordinador confirma quién queda" valor={settings.requiresCoordinatorConfirmation} />
        <Numero name="reinforcementThresholdMinutes" label="A partir de cuántos minutos conviene sumar gente" valor={settings.reinforcementThresholdMinutes} min={30} max={1440} />
        <Numero name="recommendedCollaborators" label="Cuántas personas recomendar cuando se supera" valor={settings.recommendedCollaborators} min={1} max={20} />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">El formulario público</legend>
        <Tilde name="publicFormEnabled" label="Recibir pedidos por el formulario público" valor={settings.publicFormEnabled} />
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Con esto encendido, cualquiera con el enlace puede mandarte un pedido. Empieza apagado
          a propósito: publicar un formulario que recibe datos de terceros tiene que ser una
          decisión, no algo que pasó al encender el módulo.
        </p>
        <Lista name="publicFormIntro" label="Qué leen antes de completarlo" valor={settings.publicFormIntro ?? ""} />
        <Lista name="notifyEmails" label="A quién avisarle cuando entra un pedido (uno por línea)" valor={settings.notifyEmails.join("\n")} />
      </fieldset>

      <CamposDelFormulario settings={settings} />

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Vocabularios propios</legend>
        <Lista name="zones" label="Zonas donde trabajan (una por línea)" valor={settings.zones.join("\n")} />
        <Lista name="specialties" label="Especialidades (una por línea)" valor={settings.specialties.join("\n")} />
        <Lista name="roleTemplates" label="Roles que suelen necesitar (uno por línea)" valor={settings.roleTemplates.join("\n")} />
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p> : null}

      <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

/**
 * Qué se le pregunta a quien pide una cobertura.
 *
 * Un renglón por campo, agrupados **por las mismas secciones que ve la ONG**: quien configura
 * tiene que poder leer esta pantalla como si fuera el formulario, o va a apagar cosas sin saber
 * dónde estaban.
 *
 * Los cinco campos fijos se muestran igual, bloqueados y con el motivo a la vista. Esconderlos
 * sería más prolijo y peor: quien configura se preguntaría por qué el formulario pide un correo
 * que él no configuró, y no encontraría la respuesta en ningún lado.
 */
function CamposDelFormulario({ settings }: { settings: CoverageSettingsShape }) {
  const secciones = allRequestSections({
    hidden: settings.requestFormHidden,
    required: settings.requestFormRequired,
  });

  return (
    <fieldset className="fo-card space-y-5 p-5">
      <legend className="px-1 text-sm font-semibold">Qué le preguntamos a quien pide</legend>
      <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
        Lo que apagás no aparece en el formulario y no se guarda, aunque alguien lo mande. Una
        sección que queda sin ningún campo tampoco se muestra. Cuanto más corto, más gente lo
        termina.
      </p>

      {secciones.map((seccion) => (
        <div key={seccion.key} className="space-y-2">
          <p className="text-sm font-semibold">{seccion.legend}</p>
          <div className="divide-y divide-[var(--fo-border-muted)] rounded-lg border border-[var(--fo-border)]">
            {seccion.fields.map((campo) => (
              <div
                key={campo.key}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{campo.label}</p>
                  {campo.fixed ? (
                    <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
                      Siempre se pregunta. {campo.fixedReason}
                    </p>
                  ) : null}
                </div>
                {campo.fixed ? (
                  <span className="shrink-0 self-start rounded-full bg-[var(--fo-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--fo-muted)] sm:self-auto">
                    Fijo
                  </span>
                ) : (
                  <div className="flex shrink-0 flex-wrap gap-1">
                    {REQUEST_FIELD_STATES.map((estado) => (
                      <label
                        key={estado}
                        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--fo-border)] px-2.5 py-1 text-xs has-[:checked]:border-[var(--fo-accent)] has-[:checked]:bg-[var(--fo-accent-soft)]"
                      >
                        <input
                          type="radio"
                          name={requestFieldStateInputName(campo.key)}
                          value={estado}
                          defaultChecked={campo.state === estado}
                          className="size-3.5"
                        />
                        <span>{REQUEST_FIELD_STATE_LABELS[estado]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

const CLASES =
  "w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm";

function Texto({ name, label, valor, placeholder }: { name: string; label: string; valor: string | null; placeholder: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input name={name} defaultValue={valor ?? ""} placeholder={placeholder} className={CLASES} />
    </label>
  );
}

function Numero({ name, label, valor, min, max }: { name: string; label: string; valor: number; min: number; max: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input type="number" name={name} defaultValue={valor} min={min} max={max} className={CLASES} />
    </label>
  );
}

function Tilde({ name, label, valor }: { name: string; label: string; valor: boolean }) {
  return (
    <label className="flex gap-3 text-sm leading-relaxed">
      <input type="checkbox" name={name} defaultChecked={valor} className="mt-1 size-5 shrink-0" />
      <span>{label}</span>
    </label>
  );
}

function Lista({ name, label, valor }: { name: string; label: string; valor: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <textarea name={name} rows={3} defaultValue={valor} className={CLASES} />
    </label>
  );
}
