"use client";

import type { WizardData } from "../CreateContestWizard";
import { FormField, selectWizard } from "../../../../components/ui/form";
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
    </WizardSection>
  );
}
