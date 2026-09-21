"use client";

import type { WizardData } from "../CreateContestWizard";
import { FormField, inputWizard } from "../../../../components/ui/form";
import { WizardSection } from "../../../../components/ui/wizard/WizardSection";
import { WizardUploadBox } from "../../../../components/ui/wizard/WizardUploadBox";

interface Step1GeneralDataProps {
  data: WizardData;
  updateData: (updates: Partial<WizardData>) => void;
  onTitleChange: (title: string) => void;
  onSlugManualEdit: () => void;
  fieldErrors?: Record<string, string>;
}

const textareaWizard = `${inputWizard} min-h-[6rem] resize-y md:min-h-[6.5rem]`;

export function Step1GeneralData({
  data,
  updateData,
  onTitleChange,
  onSlugManualEdit,
  fieldErrors = {},
}: Step1GeneralDataProps) {
  return (
    <div className="space-y-6 md:space-y-8">
      <WizardSection
        title="Datos principales"
        description="Con esto alcanza para publicar. El resto se puede completar después."
      >
        <div className="grid gap-6">
          <FormField
            id="title"
            label="Nombre del concurso"
            required
            variant="wizard"
            error={fieldErrors.title}
            microcopy="Corto y claro: es lo primero que se ve en el listado público."
          >
            <input
              id="title"
              type="text"
              required
              value={data.title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Ej: Concurso de Naturaleza 2025"
              className={inputWizard}
              aria-invalid={!!fieldErrors.title}
              autoComplete="off"
            />
          </FormField>

          <FormField
            id="slug"
            label="Dirección web del concurso"
            required
            variant="wizard"
            error={fieldErrors.slug}
            microcopy="Se arma solo con el nombre. Cambiala sólo si hace falta: una vez publicado, el enlace viejo deja de funcionar."
          >
            <input
              id="slug"
              type="text"
              required
              value={data.slug}
              onChange={(e) => {
                onSlugManualEdit();
                updateData({ slug: e.target.value.toLowerCase() });
              }}
              placeholder="concurso-naturaleza-2025"
              className={inputWizard}
              aria-invalid={!!fieldErrors.slug}
              autoComplete="off"
            />
          </FormField>
        </div>
      </WizardSection>

      <WizardSection
        title="Descripción"
        description="Lo que el fotógrafo lee antes de decidir si participa."
      >
        <FormField
          id="shortDescription"
          label="Descripción breve"
          required
          variant="wizard"
          error={fieldErrors.shortDescription}
          microcopy="Una o dos líneas. Aparece en el listado, debajo del nombre."
        >
          <textarea
            id="shortDescription"
            required
            rows={3}
            value={data.shortDescription}
            onChange={(e) => updateData({ shortDescription: e.target.value })}
            placeholder="Resumen corto que verán los participantes"
            className={textareaWizard}
            aria-invalid={!!fieldErrors.shortDescription}
          />
        </FormField>

        <FormField
          id="fullDescription"
          label="Descripción completa"
          variant="wizard"
          microcopy="Opcional. Bases, premios y condiciones. Se puede escribir o pegar después."
        >
          <textarea
            id="fullDescription"
            rows={5}
            value={data.fullDescription}
            onChange={(e) => updateData({ fullDescription: e.target.value })}
            placeholder="Bases, criterios, premios, condiciones generales..."
            className={`${textareaWizard} min-h-[9rem] md:min-h-[10rem]`}
          />
        </FormField>
      </WizardSection>

      <WizardSection
        title="Portada"
        description="La imagen que acompaña al concurso. Recomendado 1920×1080 px · JPG, PNG o WebP · hasta 2 MB."
      >
        <WizardUploadBox
          previewUrl={data.coverImageUrl || null}
          onDataUrl={(url) => updateData({ coverImageUrl: url })}
          onClear={() => updateData({ coverImageUrl: "" })}
        />
      </WizardSection>
    </div>
  );
}
