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
    </WizardSection>
  );
}
