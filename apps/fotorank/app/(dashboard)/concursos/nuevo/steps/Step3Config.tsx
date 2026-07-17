"use client";

import type { WizardData } from "../CreateContestWizard";
import { FormField, inputWizard, selectWizard } from "../../../../components/ui/form";
import { WizardSection } from "../../../../components/ui/wizard/WizardSection";

interface Step3ConfigProps {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
}

export function Step3Config({ data, updateData }: Step3ConfigProps) {
  return (
    <WizardSection variant="plain">
      <FormField
        id="status"
        label="Estado del concurso"
        variant="wizard"
        microcopy="Borrador: solo tu equipo. Publicado: según la visibilidad de abajo."
      >
        <select
          id="status"
          value={data.status}
          onChange={(e) => updateData({ status: e.target.value as WizardData["status"] })}
          className={selectWizard}
        >
          <option value="DRAFT">Borrador</option>
          <option value="SETUP_IN_PROGRESS">En configuración</option>
          <option value="READY_TO_PUBLISH">Listo para publicar</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="CLOSED">Cerrado</option>
          <option value="ARCHIVED">Archivado</option>
        </select>
      </FormField>

      <FormField
        id="visibility"
        label="Visibilidad"
        variant="wizard"
        microcopy="Público: listados. No listado: solo con enlace. Privado: solo organización."
      >
        <select
          id="visibility"
          value={data.visibility}
          onChange={(e) => updateData({ visibility: e.target.value as WizardData["visibility"] })}
          className={selectWizard}
        >
          <option value="PUBLIC">Público</option>
          <option value="UNLISTED">No listado</option>
          <option value="PRIVATE">Privado</option>
        </select>
      </FormField>

      <FormField
        id="experienceType"
        label="Tipo de experiencia"
        variant="wizard"
        microcopy="Define el formato público. Clickatón oficial requiere Maratón + canal Clickatón. Independiente de la visibilidad."
      >
        <select
          id="experienceType"
          value={data.experienceType}
          onChange={(e) => {
            const experienceType = e.target.value as WizardData["experienceType"];
            updateData({
              experienceType,
              // Concurso tradicional no puede ir a Clickatón.
              ...(experienceType === "CONTEST" && data.distributionChannel === "CLICKATON"
                ? { distributionChannel: null }
                : {}),
            });
          }}
          className={selectWizard}
        >
          <option value="CONTEST">Concurso</option>
          <option value="MARATHON">Maratón</option>
        </select>
      </FormField>

      <FormField
        id="distributionChannel"
        label="Canal de publicación"
        variant="wizard"
        microcopy="Define en qué portal público podrá aparecer este evento. La visibilidad del evento se configura por separado."
      >
        <select
          id="distributionChannel"
          value={data.distributionChannel ?? ""}
          onChange={(e) => {
            const channel = e.target.value === "CLICKATON" ? "CLICKATON" : null;
            updateData({
              distributionChannel: channel,
              // Clickatón implica maratón oficial.
              ...(channel === "CLICKATON" ? { experienceType: "MARATHON" as const } : {}),
            });
          }}
          className={selectWizard}
        >
          <option value="">Solo FotoRank</option>
          <option value="CLICKATON">Clickatón</option>
        </select>
      </FormField>

      <div className="mt-10 space-y-6 border-t border-zinc-800 pt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Inscripción</h3>

        <label className="flex items-start gap-3 text-sm text-fr-primary">
          <input
            type="checkbox"
            checked={data.registrationEnabled}
            onChange={(e) =>
              updateData({
                registrationEnabled: e.target.checked,
                ...(e.target.checked && !data.registrationPricingMode
                  ? { registrationPricingMode: "FREE" as const }
                  : {}),
              })
            }
            className="mt-1 size-4 rounded border-zinc-600"
          />
          <span>
            Habilitar inscripción pública
            <span className="mt-1 block text-xs text-zinc-500">
              Si está deshabilitada, Clickatón no mostrará CTA operativo. Independiente del canal y la
              visibilidad.
            </span>
          </span>
        </label>

        <FormField
          id="registrationPricingMode"
          label="Modalidad"
          variant="wizard"
          microcopy="Gratuita o paga. El precio solo aplica si es paga."
        >
          <select
            id="registrationPricingMode"
            value={data.registrationPricingMode ?? "FREE"}
            onChange={(e) =>
              updateData({
                registrationPricingMode: e.target.value as "FREE" | "PAID",
                ...(e.target.value === "FREE"
                  ? { registrationPriceAmountMinor: "", registrationCurrency: "" }
                  : { registrationCurrency: data.registrationCurrency || "ARS" }),
              })
            }
            disabled={!data.registrationEnabled}
            className={selectWizard}
          >
            <option value="FREE">Gratuita</option>
            <option value="PAID">Paga</option>
          </select>
        </FormField>

        {data.registrationPricingMode === "PAID" ? (
          <>
            <FormField
              id="registrationPriceAmountMinor"
              label="Precio (centavos)"
              variant="wizard"
              microcopy="Unidades mínimas enteras. Ej.: 2000000 = $20.000 ARS. Sin float."
            >
              <input
                id="registrationPriceAmountMinor"
                type="number"
                min={1}
                step={1}
                value={data.registrationPriceAmountMinor}
                onChange={(e) => updateData({ registrationPriceAmountMinor: e.target.value })}
                disabled={!data.registrationEnabled}
                className={inputWizard}
                placeholder="2000000"
              />
            </FormField>
            <FormField
              id="registrationCurrency"
              label="Moneda"
              variant="wizard"
              microcopy="Código ISO (ARS, USD, …)."
            >
              <input
                id="registrationCurrency"
                value={data.registrationCurrency}
                onChange={(e) =>
                  updateData({ registrationCurrency: e.target.value.toUpperCase() })
                }
                disabled={!data.registrationEnabled}
                className={inputWizard}
                placeholder="ARS"
              />
            </FormField>
          </>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            id="registrationOpensAt"
            label="Fecha de apertura"
            variant="wizard"
            microcopy="Vacío: se usa la apertura del evento como fallback público."
          >
            <input
              id="registrationOpensAt"
              type="datetime-local"
              value={data.registrationOpensAt}
              onChange={(e) => updateData({ registrationOpensAt: e.target.value })}
              disabled={!data.registrationEnabled}
              className={inputWizard}
            />
          </FormField>
          <FormField
            id="registrationClosesAt"
            label="Fecha de cierre"
            variant="wizard"
            microcopy="Vacío: se usa el deadline de envío como fallback."
          >
            <input
              id="registrationClosesAt"
              type="datetime-local"
              value={data.registrationClosesAt}
              onChange={(e) => updateData({ registrationClosesAt: e.target.value })}
              disabled={!data.registrationEnabled}
              className={inputWizard}
            />
          </FormField>
        </div>

        <FormField
          id="registrationCapacity"
          label="Cupo"
          variant="wizard"
          microcopy="Vacío = sin límite publicado. Solo se muestra remainingSpots cuando el conteo sea fiable (09B)."
        >
          <input
            id="registrationCapacity"
            type="number"
            min={1}
            step={1}
            value={data.registrationCapacity}
            onChange={(e) => updateData({ registrationCapacity: e.target.value })}
            disabled={!data.registrationEnabled}
            className={inputWizard}
            placeholder="Sin límite"
          />
        </FormField>

        <label className="flex items-start gap-3 text-sm text-fr-primary">
          <input
            type="checkbox"
            checked={data.hasOptionalMerchandise}
            onChange={(e) => updateData({ hasOptionalMerchandise: e.target.checked })}
            className="mt-1 size-4 rounded border-zinc-600"
          />
          <span>
            Ofrecer merchandising opcional
            <span className="mt-1 block text-xs text-zinc-500">
              El merchandising se configurará en una etapa posterior. Por ahora, esta opción solo
              informa que el evento podrá ofrecer productos opcionales en una etapa futura (sin catálogo ni cobro en 09B1).
            </span>
          </span>
        </label>
      </div>
    </WizardSection>
  );
}
