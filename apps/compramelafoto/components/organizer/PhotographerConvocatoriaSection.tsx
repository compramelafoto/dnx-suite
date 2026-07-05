"use client";

import type { InviteListVisibility, PhotographerConvocatoriaMode } from "@/lib/organizer-event-convocatoria";

type Props = {
  mode: PhotographerConvocatoriaMode;
  onModeChange: (mode: PhotographerConvocatoriaMode) => void;
  inviteVisibility: InviteListVisibility;
  onInviteVisibilityChange: (v: InviteListVisibility) => void;
  disabled?: boolean;
  /** Distinto en alta vs edición para evitar ids duplicados si algún día conviven en la misma vista. */
  fieldIdPrefix?: string;
};

export default function PhotographerConvocatoriaSection({
  mode,
  onModeChange,
  inviteVisibility,
  onInviteVisibilityChange,
  disabled = false,
  fieldIdPrefix = "photographer-convocatoria",
}: Props) {
  const cardBase =
    "rounded-2xl border p-4 cursor-pointer transition-colors min-w-0 " +
    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#c27b3d] has-[:focus-visible]:ring-offset-2";

  const legendId = `${fieldIdPrefix}-legend`;
  const hintId = `${fieldIdPrefix}-hint`;

  return (
    <section className="ds-organizer-panel ds-organizer-panel--stack" aria-labelledby={legendId}>
      <fieldset disabled={disabled} className="m-0 p-0 border-0 min-w-0 space-y-4">
        <legend id={legendId} className="text-lg font-semibold text-[#111827] px-0 mb-0">
          ¿Cómo se suman los fotógrafos al evento?
        </legend>
        <p id={hintId} className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 mb-0 m-0">
          Elegí cómo querés que los fotógrafos participen. Esto define quién puede pedir entrar y si el evento puede
          aparecer en la búsqueda pública de convocatorias. No modifica la visibilidad comercial de los álbumes de los
          fotógrafos.
        </p>

        <div className="space-y-3" role="radiogroup" aria-labelledby={legendId} aria-describedby={hintId}>
          <label
            className={`${cardBase} block ${
              mode === "open"
                ? "border-[#c27b3d] bg-[#c27b3d]/08"
                : "border-[#111827]/10 bg-white hover:bg-gray-50/80"
            }`}
          >
            <div className="flex gap-3 items-start">
              <input
                type="radio"
                name={`${fieldIdPrefix}-mode`}
                className="mt-1 text-[#c27b3d] shrink-0"
                checked={mode === "open"}
                disabled={disabled}
                onChange={() => onModeChange("open")}
              />
              <div className="min-w-0 ds-content-container">
                <span className="text-sm font-medium text-gray-900">Evento abierto</span>
                <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-600 mt-1 m-0">
                  Los fotógrafos cercanos pueden sumarse automáticamente al aceptar las condiciones. El evento puede
                  aparecer en el listado público de la plataforma.
                </p>
              </div>
            </div>
          </label>

          <label
            className={`${cardBase} block ${
              mode === "approval"
                ? "border-[#c27b3d] bg-[#c27b3d]/08"
                : "border-[#111827]/10 bg-white hover:bg-gray-50/80"
            }`}
          >
            <div className="flex gap-3 items-start">
              <input
                type="radio"
                name={`${fieldIdPrefix}-mode`}
                className="mt-1 text-[#c27b3d] shrink-0"
                checked={mode === "approval"}
                disabled={disabled}
                onChange={() => onModeChange("approval")}
              />
              <div className="min-w-0 ds-content-container">
                <span className="text-sm font-medium text-gray-900">Evento con aprobación</span>
                <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-600 mt-1 m-0">
                  Los fotógrafos pueden solicitar participar y vos aprobás quién entra desde tu panel. El evento puede
                  aparecer en el listado público. Hasta que sean aprobados, no podrán subir fotos al evento.
                </p>
              </div>
            </div>
          </label>

          <label
            className={`${cardBase} block ${
              mode === "invite_only"
                ? "border-[#c27b3d] bg-[#c27b3d]/08"
                : "border-[#111827]/10 bg-white hover:bg-gray-50/80"
            }`}
          >
            <div className="flex gap-3 items-start">
              <input
                type="radio"
                name={`${fieldIdPrefix}-mode`}
                className="mt-1 text-[#c27b3d] shrink-0"
                checked={mode === "invite_only"}
                disabled={disabled}
                onChange={() => onModeChange("invite_only")}
              />
              <div className="min-w-0 ds-content-container">
                <span className="text-sm font-medium text-gray-900">Privado por invitación</span>
                <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-600 mt-1 m-0">
                  Solo pueden participar los fotógrafos que invites manualmente. El evento no aparece en la búsqueda
                  pública de convocatorias.
                </p>
              </div>
            </div>
          </label>
        </div>

        {mode === "invite_only" ? (
          <div
            className="mt-4 rounded-2xl border border-[#111827]/10 bg-gray-50/90 p-4 space-y-3 min-w-0"
            role="radiogroup"
            aria-label="Visibilidad del link del evento"
          >
            <p className="text-sm font-medium text-gray-800 m-0">Visibilidad del link del evento</p>
            <label className="flex gap-3 items-start cursor-pointer">
              <input
                type="radio"
                name={`${fieldIdPrefix}-invite-vis`}
                className="mt-1 text-[#c27b3d] shrink-0"
                checked={inviteVisibility === "UNLISTED"}
                disabled={disabled}
                onChange={() => onInviteVisibilityChange("UNLISTED")}
              />
              <span className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 min-w-0">
                <strong>Solo con el link</strong> — no aparece en el listado público; quien tenga el enlace puede ver la
                página de invitación (solo fotógrafos invitados pueden unirse).
              </span>
            </label>
            <label className="flex gap-3 items-start cursor-pointer">
              <input
                type="radio"
                name={`${fieldIdPrefix}-invite-vis`}
                className="mt-1 text-[#c27b3d] shrink-0"
                checked={inviteVisibility === "PRIVATE"}
                disabled={disabled}
                onChange={() => onInviteVisibilityChange("PRIVATE")}
              />
              <span className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 min-w-0">
                <strong>Lista cerrada</strong> — mismo comportamiento ante la invitación; marcado como más restrictivo
                para uso interno.
              </span>
            </label>
          </div>
        ) : null}
      </fieldset>
    </section>
  );
}
